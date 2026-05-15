import type { AudioStatus } from '../store/slices/audioSlice'
import type { TranscriptSegment, TranscriptStatus } from '../store/slices/contextSlice'
import type { FrameSample, FrameSamplingStatus, FrameSummary, FrameSummaryStatus } from '../store/slices/frameSlice'
import type { MediaKind } from '../store/slices/videoSlice'
import type { GenerationSettings } from '../types/generation'
import { FrameSamplingSection } from './FrameSamplingSection'
import { AudioSection, MediaMetadataGrid, MediaPreview, TranscriptSection, VideoWarnings } from './VideoUploadPanelSections'

interface MediaReadySectionsProps {
  mediaKind: MediaKind | null
  fileUrl: string | null
  name: string | null
  size: number | null
  duration: number | null
  type: string | null
  sessionId: string | null
  warnings: string[]
  isAudioInput: boolean
  isVideoInput: boolean
  settings: GenerationSettings
  modelReady: boolean
  audio: {
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
  }
  transcript: {
    status: TranscriptStatus
    progress: number
    phase: string | null
    error: string | null
    warnings: string[]
    segments: TranscriptSegment[]
    isTranscribing: boolean
  }
  frames: {
    status: FrameSamplingStatus
    progress: number
    phase: string | null
    error: string | null
    samples: FrameSample[]
    summaries: FrameSummary[]
    summaryStatus: FrameSummaryStatus
    summaryProgress: number
    summaryPhase: string | null
    summaryError: string | null
    summaryWarnings: string[]
    isSampling: boolean
    isSummarizing: boolean
  }
  onExtractAudio: () => void
  onSampleFrames: () => void
  onSummarizeFrames: () => void
  onTranscribe: () => void
}

export const MediaReadySections = ({
  mediaKind,
  fileUrl,
  name,
  size,
  duration,
  type,
  sessionId,
  warnings,
  isAudioInput,
  isVideoInput,
  settings,
  modelReady,
  audio,
  transcript,
  frames,
  onExtractAudio,
  onSampleFrames,
  onSummarizeFrames,
  onTranscribe,
}: MediaReadySectionsProps) => (
  <>
    <MediaPreview mediaKind={mediaKind} fileUrl={fileUrl} />
    <MediaMetadataGrid mediaKind={mediaKind} name={name} size={size} duration={duration} type={type} sessionId={sessionId} />
    {warnings.length > 0 && <VideoWarnings warnings={warnings} />}
    {isVideoInput && (
      <FrameSamplingSection
        status={frames.status}
        progress={frames.progress}
        phase={frames.phase}
        error={frames.error}
        samples={frames.samples}
        summaries={frames.summaries}
        summaryStatus={frames.summaryStatus}
        summaryProgress={frames.summaryProgress}
        summaryPhase={frames.summaryPhase}
        summaryError={frames.summaryError}
        summaryWarnings={frames.summaryWarnings}
        settings={settings}
        isSampling={frames.isSampling}
        isSummarizing={frames.isSummarizing}
        modelReady={modelReady}
        onSampleFrames={onSampleFrames}
        onSummarizeFrames={onSummarizeFrames}
      />
    )}
    <AudioSection
      isAudioInput={isAudioInput}
      isVideoInput={isVideoInput}
      status={audio.status}
      progress={audio.progress}
      phase={audio.phase}
      error={audio.error}
      objectUrl={audio.objectUrl}
      fileName={audio.fileName}
      size={audio.size}
      format={audio.format}
      sampleRate={audio.sampleRate}
      mimeType={audio.mimeType}
      settings={settings}
      onExtractAudio={onExtractAudio}
    />
    {audio.status === 'ready' && (
      <TranscriptSection
        status={transcript.status}
        progress={transcript.progress}
        phase={transcript.phase}
        error={transcript.error}
        warnings={transcript.warnings}
        segments={transcript.segments}
        settings={settings}
        modelReady={modelReady}
        isTranscribing={transcript.isTranscribing}
        onTranscribe={onTranscribe}
      />
    )}
  </>
)
