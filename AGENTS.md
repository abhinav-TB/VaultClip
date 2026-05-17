# VaultClip Agent Notes

These instructions are shared repo context for Codex-style coding agents working
on VaultClip.

## Product Focus

- Browser-only video and transcript MVP.
- Keep model runtime state visible and deterministic.
- Primary user flow: select one local media file, validate guardrails, preview it,
  extract or register transcription-ready audio, transcribe with Gemma, then use
  the transcript for local chat/Q&A.
- The user should always understand whether media, audio, transcript, and Gemma
  are ready, loading, blocked, or failed.

## Architecture Summary

- UI is React + Redux Toolkit + Tailwind.
- Expensive work runs in `src/workers/pipeline.worker.ts` and focused worker
  modules under `src/workers`.
- Gemma loads through Transformers.js in `src/workers/gemmaRuntime.ts`.
- ffmpeg.wasm is shared inside the worker through `src/workers/ffmpegRuntime.ts`.
- Video/audio validation and metadata probing live in `src/lib/video.ts`.
- Main upload orchestration lives in `src/components/VideoUploadPanel.tsx`;
  presentational sections live in `src/components/VideoUploadPanelSections.tsx`.
- Worker request/response contracts live in `src/workers/types.ts`.

## Data Ownership

- Keep Redux state serializable.
- Do not store `File`, `Blob`, raw audio bytes, model objects, worker objects, or
  ffmpeg instances in Redux.
- Store selected video `File` objects in `src/lib/videoFileRegistry.ts`.
- Store extracted/uploaded audio bytes in `src/lib/audioDataRegistry.ts`.
- Store preview/playback data as object URLs in Redux metadata only, and revoke
  old URLs on replace, reset, and unmount.
- Use session IDs to ignore stale worker results after media replacement.

## Runtime Constraints

- Browser APIs cannot reliably expose total system RAM, GPU memory, or exact
  model memory usage. Treat memory data as debug-only.
- Gemma audio transcription currently uses fixed chunks capped to 30 seconds.
- The user-facing "unlimited" transcript output setting still maps to a bounded
  generation cap because browser inference requires a finite `max_new_tokens`.
- Direct audio uploads skip extraction but still register audio bytes for
  transcription.

## Operations Context

- These notes are the tracked source of truth for GitHub branch protection,
  Actions, semantic-release, Cloudflare Workers deployments, preview URLs, and
  common CI or deploy failures. Keep operational guidance here unless a tracked
  runbook is intentionally added to the repository.
- Branch flow is `feature branch -> development -> main -> release`.
  `development` is the integration branch; `main` is the release branch.
- New PRs should target `development` by default when the repository default
  branch is set to `development`. Releases still only run from `main`.
- Pull requests into `development` are expected to require one approval from any
  eligible reviewer, the `commit-lint` status check, up-to-date branches,
  blocked force pushes, and restricted deletions. Code owner review is not
  required unless `.github/CODEOWNERS` is intentionally reintroduced.
- Do not enable GitHub code scanning requirements unless a CodeQL or equivalent
  scanner exists and has successfully uploaded results.
- Commit messages must use the allowed conventional types in
  `commitlint.config.js`: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
  `chore`, or `revert`. Use `chore` for workflow and ops changes unless the
  commitlint config is expanded.
- The release workflow runs on pushes to `main`. It runs a `verify` job first,
  then the `release` job waits on the `production-release` GitHub environment
  approval before semantic-release publishes.
- semantic-release uses `.releaserc.json`, releases only from `main`, updates
  `CHANGELOG.md`, creates GitHub releases, and pushes the changelog commit
  through `@semantic-release/git`. Keep release workflow permissions sufficient
  for `contents`, `issues`, and `pull-requests` writes.
- Cloudflare deploys this app as a Worker with static assets, not classic Pages.
  `wrangler.jsonc` controls the Worker entrypoint, `ASSETS` binding, SPA
  fallback, and preview URLs.
- Cloudflare production builds use `npm run build` and `npx wrangler deploy`.
  Non-production/PR previews use `npx wrangler versions upload`.
- Each PR or branch preview should point at that PR branch's latest deployed
  commit or exact Worker version, not at shared `development` or production.
- Cloudflare Workers static assets have a 25 MiB per-file limit. Do not
  statically import `ffmpeg-core.wasm`; `src/workers/ffmpegRuntime.ts` must load
  the large ffmpeg WASM from `VITE_FFMPEG_WASM_URL` or the pinned CDN fallback.
- Deployed Worker origins use the `/hf/...` proxy in `src/cloudflareWorker.ts`
  for Hugging Face model files to avoid browser CORS failures. Local Vite dev
  must continue using direct Hugging Face URLs because localhost does not serve
  the Worker proxy route.
- If a custom production domain is added, update model host selection so that
  the custom domain also uses the `/hf` proxy.

## Required Checks

- Run `npm run check` after meaningful TypeScript, worker, Redux, or UI changes.
- If only documentation changes are made, run at least `npm run check:standards`
  when relevant.
- Restore generated `tsconfig.*.tsbuildinfo` files after builds unless the user
  explicitly wants them committed.
- Use `npm run dev -- --host 127.0.0.1` when a local browser test is needed.

## Documentation Standard

- Use TSDoc (`/** ... */`) for exported functions, types, classes, shared
  helpers, worker entrypoints, registries, and state contracts when behavior or
  ownership is not obvious.
- Use `@param`, `@returns`, and `@throws` only when they add review/debug value.
- Use `//` only for implementation reasoning such as cleanup, browser/runtime
  limitations, retry behavior, or non-obvious tradeoffs.
- Do not add comments that restate variable names, TypeScript types, or obvious
  JSX.

## Architecture Rules

- Store non-serializable browser data in explicit registries or object URLs, and
  make cleanup ownership clear.
- Worker request/response shapes belong in `src/workers/types.ts`.
- Worker modules should stay focused. Split when a file starts mixing runtime
  setup, task orchestration, and UI-facing normalization.
- React components should stay focused. Split presentational sections out of
  orchestration-heavy components before adding comments.
- Prefer existing local helpers, slices, and worker message patterns over new
  abstractions.
- When changing upload/replacement/reset behavior, verify downstream audio and
  transcript state is cleared correctly while model state is preserved.

## Guardrails

- Do not use `@ts-ignore` or blanket `eslint-disable`.
- Do not leave unresolved `TODO` or `FIXME` comments.
- Avoid adding large files that violate `scripts/check-code-standards.mjs`; split
  instead.
- Preserve existing user changes in the working tree. Do not revert unrelated
  edits.

## Useful Commands

```bash
npm run dev -- --host 127.0.0.1
npm run lint
npm run check:standards
npm run build
npm run check
```
