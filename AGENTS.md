# Clip Mind Agent Notes

These instructions are shared repo context for Codex-style coding agents working
on Clip Mind.

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
