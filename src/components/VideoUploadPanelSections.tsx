import { useEffect, useRef } from 'react'
import type { GenerationSettings } from '../types/generation'
import { formatAudioSampleRate, formatDuration, formatFileSize } from '../lib/format'
import { VIDEO_ACCEPT } from '../lib/video'
import type { AudioStatus } from '../store/slices/audioSlice'
import type { MediaKind, VideoStatus } from '../store/slices/videoSlice'
import type { TranscriptSegment, TranscriptStatus } from '../store/slices/contextSlice'

interface VideoMetadataItemProps {
  label: string
  value: string
  wide?: boolean
}

/** Displays one truncating metadata label/value pair inside the media panel. */
export const VideoMetadataItem = ({ label, value, wide = false }: VideoMetadataItemProps) => (
  <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</div>
    <div className="truncate text-sm text-gray-200" title={value}>
      {value}
    </div>
  </div>
)

interface MediaPanelHeaderProps {
  isReady: boolean
  isLoading: boolean
  status: VideoStatus
}

/** Header for the active media card, including the current acceptance state. */
export const MediaPanelHeader = ({ isReady, isLoading, status }: MediaPanelHeaderProps) => (
  <div className="flex items-start justify-between gap-4 border-b border-gray-800 bg-gray-800/50 p-4">
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isReady ? 'bg-green-500' : isLoading ? 'bg-yellow-400 animate-pulse' : status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`} />
        <span className="text-sm font-semibold text-gray-200">Source Media</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">One local video or audio file is active for analysis in this workspace.</p>
    </div>
    <span className="shrink-0 rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
      {isReady ? 'Ready' : isLoading ? 'Checking file' : status === 'error' ? 'Needs review' : 'No file'}
    </span>
  </div>
)

interface MediaDropZoneProps {
  settings: GenerationSettings
  onChoose: () => void
  onFiles: (files: FileList | File[]) => void
}

/** Empty-state drop zone for selecting the single active media session. */
export const MediaDropZone = ({ settings, onChoose, onFiles }: MediaDropZoneProps) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onChoose}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onChoose()
      }
    }}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault()
      onFiles(event.dataTransfer.files)
    }}
    className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-950/60 p-8 text-center transition-colors hover:border-blue-500/70 hover:bg-blue-500/5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
  >
    <div className="mb-5 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-blue-300">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
      </svg>
    </div>
    <p className="text-xl font-bold tracking-tight text-gray-100">Add a recording to begin</p>
    <p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">
      Drop in a video or audio file, or browse from your computer. VaultClip checks the file before preparing context.
    </p>
    <div className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-blue-500">
      Choose File
    </div>
    <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
      MP4, WebM, MOV, MP3, WAV, M4A, FLAC, Ogg
    </div>
    <p className="mt-3 text-xs text-gray-600">
      Limits: {settings.maxVideoSizeMb} MB and {settings.maxVideoDurationMinutes} minutes
    </p>
  </div>
)

export interface NextActionPanelConfig {
  title: string
  detail: string
  statusLabel: string
  primaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
    title?: string
  }
  secondaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
    title?: string
  }
}

export const NextActionPanel = ({
  title,
  detail,
  statusLabel,
  primaryAction,
  secondaryAction,
}: NextActionPanelConfig) => (
  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-300">{statusLabel}</div>
        <p className="mt-1 text-base font-semibold text-gray-100">{title}</p>
        <p className="mt-1 text-sm leading-6 text-blue-100/70">{detail}</p>
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-40">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              title={primaryAction.title}
              className="rounded-lg border border-blue-500/50 bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              title={secondaryAction.title}
              className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:border-gray-800 disabled:text-gray-600"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  </div>
)

interface MediaPreviewProps {
  mediaKind: MediaKind | null
  fileUrl: string | null
}

/** Browser-native preview for the selected audio or video file. */
export const MediaPreview = ({ mediaKind, fileUrl }: MediaPreviewProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const handleSeek = (event: Event) => {
      const detail = (event as CustomEvent<{ time?: number }>).detail
      const mediaElement = audioRef.current ?? videoRef.current
      if (mediaElement && typeof detail?.time === 'number') {
        mediaElement.currentTime = Math.max(0, detail.time)
      }
    }

    window.addEventListener('clipmind:seek-media', handleSeek)
    return () => window.removeEventListener('clipmind:seek-media', handleSeek)
  }, [])

  return mediaKind === 'audio' ? (
    <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-5">
      <p className="mb-3 text-sm font-semibold text-gray-100">Audio preview</p>
      <audio ref={audioRef} src={fileUrl ?? undefined} controls className="w-full" />
    </div>
  ) : (
    <video
      ref={videoRef}
      src={fileUrl ?? undefined}
      controls
      className="aspect-video min-h-[360px] w-full rounded-lg border border-gray-800 bg-black object-contain lg:min-h-[460px]"
    />
  )
}

interface MediaMetadataGridProps {
  mediaKind: MediaKind | null
  name: string | null
  size: number | null
  duration: number | null
  type: string | null
  sessionId: string | null
}

/** Shows serializable metadata for the active media session. */
export const MediaMetadataGrid = ({ mediaKind, name, size, duration, type, sessionId }: MediaMetadataGridProps) => (
  <div className="grid gap-4 rounded-lg border border-gray-800 bg-gray-950/70 p-5 sm:grid-cols-2 xl:grid-cols-3">
    <VideoMetadataItem label="File" value={name ?? 'Unknown'} wide />
    <VideoMetadataItem label="Size" value={formatFileSize(size)} />
    <VideoMetadataItem label="Duration" value={formatDuration(duration)} />
    <VideoMetadataItem label="Type" value={type || 'Unknown'} />
    <VideoMetadataItem label="Input" value={mediaKind === 'audio' ? 'Audio' : 'Video'} />
    <VideoMetadataItem label="Session" value={sessionId ?? 'Unknown'} />
  </div>
)

export const LoadingMetadataNotice = () => (
  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
    Reviewing file details...
  </div>
)

interface MediaErrorNoticeProps {
  error: string | null
  name: string | null
  size: number | null
}

export const MediaErrorNotice = ({ error, name, size }: MediaErrorNoticeProps) => (
  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
    <p className="text-sm font-semibold text-red-100">This file could not be prepared</p>
    <p className="mt-1 text-sm leading-6 text-red-200/80">{error}</p>
    {name && (
      <p className="mt-2 text-xs text-red-200/60">
        {name} {size ? `- ${formatFileSize(size)}` : ''}
      </p>
    )}
  </div>
)

export const VideoWarnings = ({ warnings }: { warnings: string[] }) => (
  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
    <p className="text-sm font-semibold text-yellow-100">Approaching processing limit</p>
    <ul className="mt-2 space-y-1 text-sm leading-6 text-yellow-100/80">
      {warnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
    </ul>
    <p className="mt-2 text-xs text-yellow-100/60">
      You can increase or remove limits in the Settings panel.
    </p>
  </div>
)

interface AudioSectionProps {
  isAudioInput: boolean
  isVideoInput: boolean
  status: AudioStatus
  progress: number
  phase: string | null
  error: string | null
  objectUrl: string | null
  fileName: string | null
  size: number | null
  format: string | null
  sampleRate: number | null
  mimeType: string | null
  settings: GenerationSettings
  onExtractAudio: () => void
}

/** Audio extraction/readiness area shown after media metadata is accepted. */
export const AudioSection = ({
  isAudioInput,
  isVideoInput,
  status,
  progress,
  phase,
  error,
  objectUrl,
  fileName,
  size,
  format,
  sampleRate,
  mimeType,
  settings,
  onExtractAudio,
}: AudioSectionProps) => {
  const isExtractingAudio = status === 'extracting'

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-100">Transcription audio</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {isAudioInput
              ? 'Uploaded audio is ready for transcription.'
              : `Output: mono ${settings.audioFormat.toUpperCase()} at ${formatAudioSampleRate(settings.audioSampleRate)}.`}
          </p>
        </div>
        {isVideoInput && (
          <button
            type="button"
            onClick={onExtractAudio}
            disabled={isExtractingAudio}
            className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
          >
            {status === 'ready' ? 'Extract Again' : isExtractingAudio ? 'Extracting...' : 'Extract Audio'}
          </button>
        )}
        {isAudioInput && status === 'ready' && (
          <span className="shrink-0 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-green-200">
            Audio Ready
          </span>
        )}
      </div>

      {isExtractingAudio && (
        <ProgressBar progress={progress} phase={phase ?? 'Extracting audio'} colorClass="bg-blue-500" />
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-red-100">Audio extraction failed</p>
          <p className="mt-1 text-sm leading-6 text-red-200/80">{error}</p>
        </div>
      )}

      {status === 'ready' && objectUrl && (
        <div className="mt-4 space-y-3">
          {isVideoInput && <audio src={objectUrl} controls className="w-full" />}
          <div className="grid gap-3 sm:grid-cols-2">
            <VideoMetadataItem label="Audio file" value={fileName ?? 'Unknown'} />
            <VideoMetadataItem label="Audio size" value={formatFileSize(size)} />
            <VideoMetadataItem label="Format" value={format === 'source' ? mimeType ?? 'Source audio' : (format ?? settings.audioFormat).toUpperCase()} />
            <VideoMetadataItem label="Sample rate" value={formatAudioSampleRate(sampleRate ?? settings.audioSampleRate)} />
          </div>
        </div>
      )}
    </div>
  )
}

interface TranscriptSectionProps {
  status: TranscriptStatus
  progress: number
  phase: string | null
  error: string | null
  warnings: string[]
  segments: TranscriptSegment[]
  settings: GenerationSettings
  modelReady: boolean
  isTranscribing: boolean
  onTranscribe: () => void
}

/** Transcript controls and progressively-rendered transcript segments. */
export const TranscriptSection = ({
  status,
  progress,
  phase,
  error,
  warnings,
  segments,
  settings,
  modelReady,
  isTranscribing,
  onTranscribe,
}: TranscriptSectionProps) => (
    <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-gray-100">Transcript</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Gemma transcription in fixed {Math.min(settings.transcriptChunkSeconds, 30)}s chunks with {settings.transcriptOverlapSeconds}s overlap. Output: {settings.transcriptMaxNewTokens === 'unlimited' ? 'unlimited per chunk' : `${settings.transcriptMaxNewTokens} tokens per chunk`}.
        </p>
      </div>
      <button
        type="button"
        onClick={onTranscribe}
        disabled={isTranscribing || !modelReady}
        className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
        title={modelReady ? 'Transcribe extracted audio' : 'Load Gemma before transcribing'}
      >
        {isTranscribing ? 'Transcribing...' : status === 'ready' ? 'Transcribe Again' : modelReady ? 'Transcribe' : 'Load Gemma First'}
      </button>
    </div>

    {isTranscribing && (
      <ProgressBar progress={progress} phase={phase ?? 'Transcribing fixed audio chunks'} colorClass="bg-green-500" />
    )}

    {status === 'error' && (
      <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
        <p className="text-sm font-semibold text-red-100">Transcription failed</p>
        <p className="mt-1 text-sm leading-6 text-red-200/80">{error}</p>
      </div>
    )}

    {warnings.length > 0 && (
      <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
        <p className="text-sm font-semibold text-yellow-100">Transcript completed with notes</p>
        <ul className="mt-1 space-y-1 text-sm leading-6 text-yellow-100/80">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    )}

    {segments.length > 0 && (
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
        {segments.map((segment) => (
          <div key={segment.id} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
            <div className="font-mono text-[11px] text-blue-300">
              {formatDuration(segment.startTime)} - {formatDuration(segment.endTime)}
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-200">{segment.text}</p>
          </div>
        ))}
      </div>
    )}
  </div>
)

interface PanelActionsProps {
  onReplace: () => void
  onReset: () => void
}

export const PanelActions = ({ onReplace, onReset }: PanelActionsProps) => (
  <div className="flex gap-3">
    <button
      type="button"
      onClick={onReplace}
      className="flex-1 rounded-lg border border-blue-500/50 bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500"
    >
      Replace File
    </button>
    <button
      type="button"
      onClick={onReset}
      className="rounded-lg border border-gray-700 px-4 py-3 text-sm font-bold text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
    >
      Reset
    </button>
  </div>
)

export const HiddenMediaInput = ({
  inputRef,
  onFiles,
}: {
  inputRef: React.RefObject<HTMLInputElement>
  onFiles: (files: FileList | File[]) => void
}) => (
  <input
    ref={inputRef}
    type="file"
    className="hidden"
    accept={VIDEO_ACCEPT}
    onChange={(event) => event.target.files && onFiles(event.target.files)}
  />
)

const ProgressBar = ({ progress, phase, colorClass }: { progress: number; phase: string; colorClass: string }) => (
  <div className="mt-4 space-y-2">
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
        <div className={`h-full transition-all duration-500 ${colorClass}`} style={{ width: `${progress}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-xs text-gray-400">{progress}%</span>
    </div>
    <p className="text-xs text-gray-500">{phase}</p>
  </div>
)
