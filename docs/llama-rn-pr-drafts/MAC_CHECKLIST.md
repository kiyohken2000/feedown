# Mac (M1 Pro MBP) — Execution Checklist

Run these steps on the MacBook Pro to take the drafts in this directory from "diff on disk" to "PR opened against `mybigday/llama.rn`".

Prereqs:
- Xcode + command-line tools installed (`xcrun --find clang` should return a path)
- Node 20+ / Yarn / Git
- An iPhone with A15 GPU paired and signed into the dev account, OR the FeedOwn EAS dev profile working
- Tested on iOS 18.x — same as the issue repro

---

## Phase 1 — Set up the llama.rn fork (≈10 min)

1. **Fork on GitHub**: visit https://github.com/mybigday/llama.rn → Fork → into your account (`votepurchase/llama.rn` or similar).

2. **Clone the fork on the Mac**:
   ```sh
   cd ~/develop
   git clone --recursive https://github.com/<your-user>/llama.rn.git
   cd llama.rn
   git remote add upstream https://github.com/mybigday/llama.rn.git
   git fetch upstream
   git checkout -b fix/metal-embed-library upstream/main
   ```
   (`--recursive` brings in the `third_party/llama.cpp` submodule. If you forget, `git submodule update --init --recursive`.)

3. **Install deps + bootstrap once on a clean tree** to confirm the baseline works:
   ```sh
   npm install
   npm run bootstrap
   ```
   This regenerates `cpp/` from `third_party/llama.cpp`. Expected: terminates cleanly, no errors.

---

## Phase 2 — Apply the drafts (≈5 min)

The drafts live under `docs/llama-rn-pr-drafts/` in the feedown repo (tracked, not in `_temp/`), so plain `git push` from Windows + `git pull` on Mac is enough. Assuming feedown is cloned to `~/develop/feedown/` on the Mac, paths below resolve cleanly.

```sh
cd ~/develop/llama.rn
git apply --check ~/develop/feedown/docs/llama-rn-pr-drafts/01-bootstrap.diff
git apply --check ~/develop/feedown/docs/llama-rn-pr-drafts/02-cmake.diff
git apply --check ~/develop/feedown/docs/llama-rn-pr-drafts/03-podspec.diff
git apply --check ~/develop/feedown/docs/llama-rn-pr-drafts/04-build-ios.diff
git apply --check ~/develop/feedown/docs/llama-rn-pr-drafts/05-agents-md.diff
```

If `--check` passes for all 5, apply for real:

```sh
git apply ~/develop/feedown/docs/llama-rn-pr-drafts/0{1,2,3,4,5}-*.diff
git status   # should show 5 modified files, no new files yet
```

If `--check` fails on any (likely because `upstream/main` has drifted since 2026-05-22), open the failing diff and re-anchor it against the current file contents. The semantics of each change are documented in `README.md`.

---

## Phase 3 — Regenerate sources + sanity check (≈3 min)

```sh
npm run bootstrap
```

After this run, verify:

```sh
ls -lh cpp/ggml-metal/ggml-metal-embed.s
# Expected: ~3-5 MB file
head -5 cpp/ggml-metal/ggml-metal-embed.s
# Expected:
#   .section __DATA,__lm_ggml_metallib
#   .globl _lm_ggml_metallib_start
#   _lm_ggml_metallib_start:
#   .byte 0x<...>,0x<...>,...
tail -3 cpp/ggml-metal/ggml-metal-embed.s
# Expected:
#   .byte ...
#   .globl _lm_ggml_metallib_end
#   _lm_ggml_metallib_end:
```

Quick TS sanity (no native effect, but catches breakage):
```sh
npm run typecheck
```

---

## Phase 4 — Build the iOS xcframework (≈15-30 min, first time)

```sh
npm run build:ios-frameworks
```

This invokes `scripts/build-ios.sh`. It will:
- Build 4 framework slices (iOS device, iOS simulator, tvOS device, tvOS simulator)
- The build step that matters: each slice's clang invocation now compiles `cpp/ggml-metal/ggml-metal-embed.s` and links the `_lm_ggml_metallib_start` / `_lm_ggml_metallib_end` symbols into the binary.
- Validate dSYM UUIDs match

Expected: `ios/rnllama.xcframework/` regenerated. If build fails on the `.s` file, the most likely cause is symbol naming (Mach-O underscore prefix) or `.section` syntax; check the assembler error and adjust `01-bootstrap.diff`.

Verify the symbol made it in:
```sh
nm ios/rnllama.xcframework/ios-arm64/rnllama.framework/rnllama | grep metallib
# Expected:
#   ........ S _lm_ggml_metallib_start
#   ........ S _lm_ggml_metallib_end
```
(Letter may vary — `S` for data section symbol, `T` for text, `D` for data — what matters is both symbols appear and are not undefined `U`.)

---

## Phase 5 — End-to-end test on iPhone A15 (≈30 min)

The FeedOwn PoC branch (`poc/llama-rn-gemma4`) already has the diagnostic UI. We'll point its `llama.rn` dependency at the local fork instead of npm.

1. **On the Mac, clone FeedOwn and check out the PoC branch**:
   ```sh
   cd ~/develop
   git clone https://github.com/<your-user>/feedown.git
   cd feedown
   git checkout poc/llama-rn-gemma4
   ```

2. **Point `llama.rn` at the local fork** — edit `apps/mobile/package.json`:
   ```json
   "llama.rn": "file:../../../llama.rn"
   ```
   (Path is relative to `apps/mobile/`. Adjust if your directory layout differs.)

3. **Reinstall + EAS dev build**:
   ```sh
   yarn install
   cd apps/mobile
   eas build --profile development --platform ios
   ```
   Or if doing a local prebuild:
   ```sh
   npx expo prebuild --platform ios --clean
   cd ios && pod install && cd ..
   npx expo run:ios --device
   ```

4. **Install on the A15 iPhone**, open FeedOwn, navigate to **Profile → Llama.rn PoC**.

5. **Tap "Enable native log" first**, then "Download" any model (Qwen3 0.6B is fastest), then "Load + benchmark".

6. **Critical log lines to confirm the fix**:
   ```
   lm_ggml_metal_library_init: using embedded metal library
   lm_ggml_metal_library_init: loaded in <N> sec
   ```
   If you see these instead of the `default.metallib not found ... XPC_ERROR_CONNECTION_INTERRUPTED` chain from #348, the fix works.

7. **Benchmark must complete** — should output tokens-per-second numbers without throwing.

8. (Bonus) **macOS smoke test**: run the maintainer's own test path from #252 — `npm run example run ios` against a macOS simulator or any macOS target — to confirm we didn't regress their `iOS 26 / macOS 26 (Metal 4.0)` validation.

---

## Phase 6 — Open the PR (≈10 min)

If Phase 5 passed:

1. **Commit the llama.rn changes** — llama.rn checks in the post-bootstrap `cpp/` snapshot (that's why `cpp/ggml-metal/ggml-metal.metal` is in the repo at clone time), so the generated `.s` file goes in too:
   ```sh
   cd ~/develop/llama.rn
   # Sanity: check llama.rn's gitignore doesn't exclude the .s file
   git check-ignore cpp/ggml-metal/ggml-metal-embed.s   # should print nothing
   git add scripts/bootstrap.sh scripts/build-ios.sh ios/CMakeLists.txt llama-rn.podspec AGENTS.md
   git add cpp/ggml-metal/ggml-metal-embed.s
   git status   # confirm only the 6 paths above are staged
   git diff --cached --stat
   git commit -m "$(cat <<'EOF'
   feat(ios): embed ggml-metal source into framework binary

   Fixes #348.

   Following the precompile-rollback rationale in #252, switch to upstream
   llama.cpp's GGML_METAL_EMBED_LIBRARY pattern: emit ggml-metal-embed.s
   during bootstrap, link it into the rnllama framework, and let
   ggml-metal-device.m's embedded code path supply the Metal source to
   newLibraryWithSource: directly. Removes the .metal resource shipping
   and the LM_GGML_METAL_PATH_RESOURCES fallback chain.

   Tested on iPhone A15 (iOS 18.x) and macOS.
   EOF
   )"
   ```

2. **Push the fork**:
   ```sh
   git push -u origin fix/metal-embed-library
   ```

3. **Open the PR**:
   ```sh
   gh pr create --repo mybigday/llama.rn \
     --title "feat(ios): embed ggml-metal source into framework binary" \
     --body "$(cat <<'EOF'
   ## Summary

   Fixes #348 by switching from the runtime `.metal` file load (introduced in #252) to the embedded-source pattern that upstream llama.cpp uses behind `GGML_METAL_EMBED_LIBRARY`. The merged Metal source is baked into the framework binary as a `__DATA` symbol range and consumed directly by `ggml-metal-device.m`'s embedded code path.

   This addresses the maintenance concern from #252 (no need to ship/precompile per-target `.metallib` files) while removing the runtime NSBundle resource lookup that #348 reported as failing on iPhone A15 with `XPC_ERROR_CONNECTION_INTERRUPTED`.

   ## Changes

   - `scripts/bootstrap.sh` — after the `LM_` prefix sed pass, emit `cpp/ggml-metal/ggml-metal-embed.s` with the merged metal source as `.byte` directives between `_lm_ggml_metallib_start` and `_lm_ggml_metallib_end` symbols in `__DATA,__lm_ggml_metallib`.
   - `ios/CMakeLists.txt` — define `LM_GGML_METAL_EMBED_LIBRARY=1`, glob `*.s` from `ggml-metal/` into the rnllama target's source list.
   - `llama-rn.podspec` — extend `RNLLAMA_BUILD_FROM_SOURCE=1` source glob to include `*.s`, drop `cpp/ggml-metal/ggml-metal.metal` from `s.resources`, define the macro alongside `LM_GGML_USE_METAL` whenever Metal is enabled.
   - `scripts/build-ios.sh` — stop copying `ggml-metal.metal` into the framework root in `copy_framework_support_files`.
   - `AGENTS.md` — describe the new step 5 of bootstrap.

   `cpp/ggml-metal/ggml-metal-device.m` itself is unchanged — the `#if GGML_METAL_EMBED_LIBRARY` branch was already in place from upstream.

   ## Testing

   - **iPhone A15 (iOS 18.x)** — repro from #348 with Qwen3-0.6B-Q4_K_M and gemma-4-E2B-it-Q4_K_M. `initLlama` succeeds, benchmarks complete, native log shows `using embedded metal library` instead of the `default.metallib not found` chain.
   - **macOS** — smoke-tested via `npm run example run ios` on a macOS target to confirm parity with the `iOS 26 / macOS 26 (Metal 4.0)` paths from #252.
   - `nm` confirms `_lm_ggml_metallib_start` / `_lm_ggml_metallib_end` are present as data symbols (not `U`) in each xcframework slice.

   ## Open question

   I left the embed path unconditional rather than gating it behind an env var (e.g. `LLAMA_METAL_EMBED=0` for the old file-based path). Happy to add a flag if you'd prefer keeping the file-based path available as a fallback — let me know.
   EOF
   )"
   ```

---

## Rollback / iteration paths

- If the assembler chokes on `.section __DATA,__lm_ggml_metallib` — try `__DATA,__ggml_metallib` (drop the prefix, sed only renames symbols not section names) or `__TEXT,__const` (read-only data).
- If `nm` shows undefined `_lm_ggml_metallib_start` — `.globl` may need to be `.globl` on its own line vs combined; or symbol name mismatch (check the `.m` file post-sed has the `lm_` prefix in the `extern` declarations).
- If init succeeds but benchmark crashes — that's likely a separate issue from #348; capture the log and investigate independently.
- If init still produces `XPC_ERROR_CONNECTION_INTERRUPTED` — `newLibraryWithSource:` is failing regardless of whether the source comes from file or memory. That points to a deeper Metal/A15 compatibility issue. Comment on #348 with the new log and pause the PR for maintainer guidance.
