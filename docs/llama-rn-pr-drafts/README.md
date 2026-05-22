# llama.rn metal-embed PR — Implementation Drafts

Drafts for the PR that fixes [llama.rn#348](https://github.com/mybigday/llama.rn/issues/348) (iOS XPC compile failure with runtime-loaded `ggml-metal.metal`).

Maintainer (@jhen0409) confirmed the preferred direction in the issue thread:

> I gave up the precompile (with #252) because I don't want to maintain two prebuilt metal libs, so I think the `ggml-metal-embed.metal` pattern might be a better way.

So we mirror upstream llama.cpp's `GGML_METAL_EMBED_LIBRARY` approach — bake the merged metal source into the framework binary as a `__DATA` symbol range, and let `cpp/ggml-metal/ggml-metal-device.m` use its existing embed code path (no patch to that file needed — it already supports both branches).

## Key findings from llama.rn source read

1. **`scripts/bootstrap.sh` already inlines `ggml-common.h` and `ggml-metal-impl.h` into `ggml-metal.metal`** (lines 119-145, awk + sed). The committed `cpp/ggml-metal/ggml-metal.metal` is the post-merge ~623 KB self-contained file. Good news: half the embed work upstream's CMake does is already in place — only the asm wrapper step is missing.

2. **`cpp/ggml-metal/ggml-metal-device.m` already has both code paths**:
   - `#if GGML_METAL_EMBED_LIBRARY` branch — uses `extern const char ggml_metallib_start[]` / `..._end[]` symbols and `[[NSString alloc] initWithBytes:length:encoding:]`.
   - `#else` branch — loads `default.metallib` from bundle, falls back to `ggml-metal.metal` source file, calls `newLibraryWithSource:`.

   After `bootstrap.sh`'s `LM_` prefix sed pass, the macro becomes `LM_GGML_METAL_EMBED_LIBRARY` and the externs become `lm_ggml_metallib_start[]` / `lm_ggml_metallib_end[]`. So we need to:
   - Define `LM_GGML_METAL_EMBED_LIBRARY` at compile time
   - Provide `_lm_ggml_metallib_start` and `_lm_ggml_metallib_end` symbols (Mach-O prefix) via assembly

3. **No `ggml-metal-device.m.patch` needed.** Earlier WebFetch suggested one existed, but it was hallucinated — the current `scripts/patches/` has no such file. The only Metal-related patch is `ggml-metal-mul-mv-id-tiitg.patch` (unrelated shader fix). We do not touch that.

4. **Two build paths consume this**:
   - **`RNLLAMA_BUILD_FROM_SOURCE=1`** (`llama-rn.podspec` line 33-41): compiles `cpp/**/*.{m,cpp,c}` directly inside the consumer Pod build.
   - **Prebuilt xcframework**: `scripts/build-ios.sh` invokes `ios/CMakeLists.txt` cmake build that produces `ios/rnllama.xcframework`. Source list in `ios/CMakeLists.txt` is glob-based.

   Both paths need the `.s` file in their source list and the macro defined.

5. **Critical caveat to communicate in the PR description**: both the embed branch and the file branch ultimately call `[device newLibraryWithSource:options:error:]`. The XPC `MTLCompilerService` is invoked at that call, not at the file read step. So switching to embed:
   - **Definitely** fixes the maintainability concern (no .metal resource shipping, no NSBundle path resolution, no `LM_GGML_METAL_PATH_RESOURCES` env var dance).
   - **Possibly** fixes the XPC bug, but no guarantee. Reasons it _might_ help: avoids a file-system round trip + NSString file decoding before the compile call (which could be a contributing factor under memory pressure on A15). The PR description should be honest about this — frame it as "the right architectural fix that we expect will resolve #348, but the embed↔compile transition still relies on `newLibraryWithSource:` working correctly on iOS". Plan for follow-up if the bug persists post-embed.

## Files

| # | Path | What it does |
|---|------|--------------|
| 01 | `01-bootstrap.diff` | Generate `cpp/ggml-metal/ggml-metal-embed.s` after the sed prefix pass in `scripts/bootstrap.sh`. |
| 02 | `02-cmake.diff` | Add `LM_GGML_METAL_EMBED_LIBRARY` define and glob `.s` files in `ios/CMakeLists.txt`. |
| 03 | `03-podspec.diff` | Update `llama-rn.podspec`: add `.s` to source_files, remove `.metal` from resources, define macro. |
| 04 | `04-build-ios.diff` | Stop copying `ggml-metal.metal` into framework root in `scripts/build-ios.sh`. |
| 05 | `05-agents-md.diff` | Update `AGENTS.md` description of bootstrap step #5. |
| - | `MAC_CHECKLIST.md` | Sequential execution steps for the M1 Pro side. |

## Open questions for the maintainer (in `_temp/llama_rn_issue_ack.txt`, not yet answered)

- **Flag-gate the embed path?** Drafts assume unconditional embed for iOS/tvOS — i.e. `LM_GGML_METAL_EMBED_LIBRARY` is always defined and `.metal` is removed from Resources. If maintainer wants a `LLAMA_METAL_EMBED=0` escape hatch, we'd need to keep the resource shipping and gate the macro.
- **Android scope** — these drafts touch iOS only. Android does not use Metal so it's a non-issue.
