# Handoff Prompt — Paste into the Mac Claude session

Copy everything below the `---` line into the Mac session as your first message. Adjust paths in the "File transfer" step to whatever you actually did.

---

I'm continuing work that I started in a Windows Claude Code session. The goal is to land a PR against `mybigday/llama.rn` that fixes issue #348 — `initLlama` failing on iPhone A15 with `XPC_ERROR_CONNECTION_INTERRUPTED` because the framework runtime-compiles `ggml-metal.metal` from a bundled file instead of carrying the source as embedded data.

## Background you need

- I run **FeedOwn** (Expo SDK 55 monorepo, on-device AI feature). I ran a PoC migrating from `react-native-executorch` to `llama.rn` on branch `poc/llama-rn-gemma4`. The PoC has a `LlamaPocCard` component on the Profile screen that loads any GGUF and runs benchmark, with `enableNativeLog` + `addNativeLogListener` wired up for raw llama.cpp logs.
- The PoC hit issue #348. I filed the issue with full diagnostics. Maintainer @jhen0409 replied that he prefers the `ggml-metal-embed.metal` pattern over precompiling `default.metallib` (his earlier #252 dropped the precompile because maintaining device + simulator metallibs was too costly).
- I drafted the full implementation on the Windows side: 5 unified diffs + a Mac execution checklist + a strategy README. They're under `docs/llama-rn-pr-drafts/` in the feedown repo.

## File transfer

The drafts are at `<feedown-path>/docs/llama-rn-pr-drafts/`:

- `README.md` — strategy, findings, caveats
- `01-bootstrap.diff` — generate `cpp/ggml-metal/ggml-metal-embed.s` via `od + awk` after the existing `LM_` prefix sed pass
- `02-cmake.diff` — `ios/CMakeLists.txt`: define `LM_GGML_METAL_EMBED_LIBRARY=1`, glob `*.s` into rnllama sources
- `03-podspec.diff` — `llama-rn.podspec`: include `*.s` in BUILD_FROM_SOURCE sources, drop `.metal` from `s.resources`, define the macro alongside `LM_GGML_USE_METAL`
- `04-build-ios.diff` — `scripts/build-ios.sh`: stop copying `.metal` to framework root
- `05-agents-md.diff` — `AGENTS.md`: update bootstrap step 5 description
- `MAC_CHECKLIST.md` — Phase 1-6 sequential steps including the final commit message and `gh pr create` invocation

The drafts are tracked under `docs/`, so I committed and pushed them from Windows; if you've already pulled the feedown repo on the Mac, they're at `~/develop/feedown/docs/llama-rn-pr-drafts/` (adjust if your checkout is elsewhere).

## What I want you to do

1. **Read `docs/llama-rn-pr-drafts/README.md` and `MAC_CHECKLIST.md` first** — they have the full design rationale and step-by-step plan. Don't skip the caveats section in README — particularly the bit about how XPC compilation might still trigger after the switch to embed, because both code paths ultimately call `[device newLibraryWithSource:]`.

2. **Walk through `MAC_CHECKLIST.md` Phase 1-3** (fork llama.rn → clone → branch → apply diffs → re-bootstrap → verify the `.s` file is generated with the expected `_lm_ggml_metallib_start` / `_lm_ggml_metallib_end` symbols and `.section __DATA,__lm_ggml_metallib`).

3. **Pause before Phase 4 (xcframework build)** and report back what you found — particularly:
   - Did all 5 `git apply --check` invocations pass, or did `upstream/main` drift since 2026-05-22 and force a re-anchor?
   - Does the regenerated `cpp/ggml-metal/ggml-metal-embed.s` look right (~3-5 MB, correct first/last lines)?
   - Does `nm` see the symbols as data (`S`/`D`), or undefined (`U`), after a successful build?

4. **Then Phase 4-5** (build xcframework, install over FeedOwn's PoC branch, test on the A15 iPhone, capture the native log).

5. **Phase 6 only if Phase 5 confirms `using embedded metal library` log + benchmark completes.** Otherwise, hold the PR and report the new log so we can decide whether the bug is deeper than embed-vs-file.

## One open question to keep an eye on

I asked the maintainer (in the ack comment) whether the embed step should run unconditionally or be flag-gated behind `LLAMA_METAL_EMBED=1` (with file-based as fallback). He hasn't replied as of this handoff. The drafts assume unconditional. If he answers "flag it," `03-podspec.diff` and `02-cmake.diff` need the macro define and the `.metal` resource removal made conditional on an env var.

Check the comment thread before going to Phase 6 — if there's a new reply with a different preference, fold that in before committing.

Issue thread: https://github.com/mybigday/llama.rn/issues/348

## Tools available on the Mac that I didn't have on Windows

- Xcode + iOS device toolchain for actually building
- `xcrun metal` / `xcrun metallib` (we don't need them, but they're there)
- iPhone for the A15 repro test
- `nm`, `otool`, full Mach-O inspection
