# VaultClip

VaultClip is a browser-only media workflow for selecting a local video or audio
file, previewing it, producing transcription-ready audio, generating a
timestamped Gemma transcript, and using the transcript for local chat/Q&A.

The MVP is designed around local-first processing: media stays in the browser,
Gemma runs locally through Transformers.js/WebGPU, and ffmpeg.wasm handles media
conversion inside a Web Worker.

## What The App Does

1. Select one local video or audio file.
2. Validate the file against browser-safe formats and configurable MVP budgets.
3. Preview the accepted media before processing.
4. Extract mono transcription-ready audio from video, or register uploaded audio
   directly.
5. Transcribe audio with Gemma in fixed chunks.
6. Render timestamped transcript segments as they are produced.
7. Use the loaded Gemma model for local chat and follow-up analysis.

The product intentionally supports one active media session at a time. Replacing
or resetting media clears downstream audio/transcript state while preserving the
loaded model state where possible.

## Tech Stack

- React 18
- TypeScript
- Vite
- Redux Toolkit
- Tailwind CSS
- Transformers.js (`@huggingface/transformers`)
- Gemma ONNX model: `onnx-community/gemma-4-E2B-it-ONNX`
- WebGPU for local model inference
- ffmpeg.wasm for browser-side audio extraction and decoding

## Runtime Requirements

- A browser with WebGPU support, usually Chrome or Edge.
- Hardware acceleration enabled.
- Enough browser/GPU resources to load and run the Gemma ONNX model.
- Network access the first time the model files are downloaded from Hugging Face.

After model files are downloaded, the browser can reuse cached model assets. The
app surfaces whether model files are being checked, loaded from cache,
downloaded, initialized, ready, or failed.

## Important Browser Storage Notes

The app does not save selected media or extracted audio to the project directory
or Downloads folder.

- Selected media `File` objects are held in browser memory through an in-memory
  registry.
- Extracted/uploaded audio bytes are held in browser memory through an in-memory
  registry.
- Preview/playback uses `blob:` object URLs.
- Object URLs are revoked on replacement, reset, and component cleanup.
- Redux stores only serializable metadata and object URL strings.

Browser memory means memory managed by the browser process. The browser may
internally optimize how Blob data is stored, but the app does not write those
artifacts to disk.

## Project Structure

```text
src/
  App.tsx
  components/
    VideoUploadPanel.tsx          # media/session orchestration
    VideoUploadPanelSections.tsx  # presentational upload/audio/transcript UI
    GemmaChat.tsx                 # local Gemma chat UI
    SettingsModal.tsx             # model, media, audio, transcript settings
  lib/
    video.ts                      # format checks, guardrails, metadata probing
    videoFileRegistry.ts          # non-serializable selected File storage
    audioDataRegistry.ts          # non-serializable audio byte storage
    format.ts                     # UI formatting and settings clamps
  services/
    workerClient.ts               # promise-based worker facade
  store/
    slices/                       # Redux state for model/media/audio/context
  workers/
    pipeline.worker.ts            # worker router
    types.ts                      # worker request/response contracts
    gemmaRuntime.ts               # Transformers.js/Gemma lifecycle
    ffmpegRuntime.ts              # shared ffmpeg.wasm lifecycle
    audioExtractionTask.ts        # video-to-audio extraction
    transcriptionTask.ts          # Gemma transcription flow
    audioChunking.ts              # fixed transcript chunks
    transcriptNormalize.ts        # model output cleanup/dedupe
```

## Data Ownership Rules

Redux state must stay serializable.

Do not put these values in Redux:

- `File`
- `Blob`
- raw audio bytes
- model instances
- worker instances
- ffmpeg instances

Use the registries instead:

- `src/lib/videoFileRegistry.ts` stores selected video files by session ID.
- `src/lib/audioDataRegistry.ts` stores extracted/uploaded audio bytes by
  session ID.

Use session IDs to ignore stale async results after the user replaces media.

## Media Guardrails

Supported media is checked before processing:

- Video: MP4, WebM, Ogg, MOV
- Audio: MP3, WAV, M4A/AAC, FLAC, Ogg/Opus, WebM audio

The settings modal controls the MVP processing budget:

- maximum file size
- maximum media duration
- audio extraction format
- audio sample rate
- transcript chunk length
- transcript overlap
- transcript output token budget

Hard-limit failures are rejected before expensive processing. Near-limit inputs
are accepted with warnings.

## Transcription Behavior

Transcription is Gemma-only.

- Video files must first run the manual Extract Audio step.
- Audio uploads are directly registered as transcription-ready audio.
- Audio is decoded to mono float samples for Gemma.
- Chunks are fixed intervals with configurable overlap.
- Chunk length is capped at 30 seconds because longer Gemma audio inputs have
  shown incomplete transcript coverage.
- Transcript output length is independent from chat output length.
- "Unlimited" transcript output maps to a large but finite generation cap because
  browser inference requires a bounded `max_new_tokens`.

The app stores normalized transcript segments with stable ordering and timestamp
ranges derived from chunk boundaries.

## Settings

The settings modal separates parameters by where they are used:

- Chat generation
- Media guardrails
- Audio extraction
- Transcription

Changing media guardrails can invalidate an already selected file. The UI should
surface that as an explicit rejection, not a silent failure.

## Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Run lint:

```bash
npm run lint
```

Run standards checks:

```bash
npm run check:standards
```

Run a production build:

```bash
npm run build
```

Run the full verification gate:

```bash
npm run check
```

`npm run check` runs lint, repository standards checks, and the production build.

## Code Standards

See `CONTRIBUTING.md` for the full standard. Key rules:

- Use TSDoc for exported/shared APIs where behavior or ownership is not obvious.
- Use short `//` comments only for implementation reasoning.
- Avoid comments that simply restate the code.
- Split large files instead of making them reviewable through comments alone.
- Keep Redux serializable.
- Avoid `@ts-ignore`, blanket `eslint-disable`, and unresolved `TODO`/`FIXME`.

The custom standards checker lives in `scripts/check-code-standards.mjs`.

## Agent Guidance

Shared Codex-style agent instructions and project configuration live in:

```text
AGENTS.md
.codex/config.toml
.codex/rules/default.rules
```

Codex discovers `AGENTS.md` automatically from the repository root. Agents should
use `npm run check` as the default verification command after meaningful code
work.

## Troubleshooting

If the model does not load:

- Confirm the browser supports WebGPU.
- Confirm hardware acceleration is enabled.
- Check whether the UI reports cache loading, network download, initialization,
  or failure.
- Reloading the tab can restart the worker and model lifecycle.

If audio extraction fails:

- Try a shorter/smaller supported video.
- Verify the file can be previewed in the browser.
- Try WAV output at 16 kHz.

If transcription appears incomplete:

- Use 30 second chunks or smaller.
- Increase transcript output tokens.
- Keep overlap small, such as 0.1 seconds, unless a specific file needs more.

## Current Limitations

- Browser APIs do not expose reliable total system RAM, GPU memory, or exact
  model memory usage.
- Transcript timestamps are segment-level chunk ranges, not word-level alignment.
- The MVP supports one active media session at a time.
- Transcription quality depends on Gemma's audio understanding and the browser
  runtime path.
