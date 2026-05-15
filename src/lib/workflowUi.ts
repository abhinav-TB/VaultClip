import type { NextActionPanelConfig } from '../components/VideoUploadPanelSections'
import type { RootState } from '../store'
import type { WorkflowStepState } from '../components/WorkflowStep'

export interface WorkflowStepView {
  label: string
  detail: string
  state: WorkflowStepState
}

export function getWorkflowState(state: RootState): { summary: string; steps: WorkflowStepView[] } {
  const mediaReady = state.video.status === 'ready'
  const contextIndexReady = state.rag.status === 'ready'
  const modelReady = state.model.status === 'ready'
  const modelLoading = state.model.status === 'loading'
  const mediaDetail = state.video.status === 'loading-metadata'
    ? 'Checking file details'
    : state.video.status === 'error'
      ? 'Replace the file'
      : mediaReady
        ? state.video.name ?? 'Media selected'
        : 'Select a file'
  const modelDetail = modelReady
    ? 'Model ready'
    : modelLoading
      ? `${state.model.progress}% loaded`
      : mediaReady
        ? 'Load the model'
        : 'Available after upload'
  const indexDetail = contextIndexReady
    ? `${state.rag.chunks.length} citations ready`
    : modelReady
      ? 'Build grounded context'
      : 'Available after model load'
  const askDetail = contextIndexReady && modelReady
    ? 'Ask with citations'
    : contextIndexReady
      ? 'Load the model to begin'
      : modelReady
        ? 'Available after indexing'
        : 'Available after indexing'
  const summary = contextIndexReady && modelReady
    ? 'Your media is ready for grounded questions with timestamped citations.'
    : modelReady && mediaReady
      ? 'Build the context once, then move directly into grounded Q&A.'
    : mediaReady
        ? 'Load the local model to prepare searchable context for this recording.'
        : 'Start with a single video or audio file. Processing stays local in this browser.'

  return {
    summary,
    steps: [
      {
        label: '1. Upload',
        detail: mediaDetail,
        state: mediaReady ? 'complete' : 'active',
      },
      {
        label: '2. Load Model',
        detail: modelDetail,
        state: modelReady ? 'complete' : mediaReady ? 'active' : 'pending',
      },
      {
        label: '3. Build Index',
        detail: indexDetail,
        state: contextIndexReady ? 'complete' : modelReady && mediaReady ? 'active' : 'pending',
      },
      {
        label: '4. Chat',
        detail: askDetail,
        state: contextIndexReady && modelReady ? 'active' : contextIndexReady ? 'blocked' : 'pending',
      },
    ],
  }
}

export interface MediaNextActionInput {
  mediaReady: boolean
  isLoading: boolean
  isVideoInput: boolean
  videoStatus: string
  audioStatus: string
  transcriptCount: number
  frameSampleCount: number
  frameSummaryCount: number
  frameStatus: string
  modelReady: boolean
  isExtractingAudio: boolean
  isTranscribing: boolean
  isSamplingFrames: boolean
  isSummarizingFrames: boolean
  chooseFile: () => void
  extractAudio: () => void
  sampleFrames: () => void
  summarizeFrames: () => void
  transcribe: () => void
}

export function getMediaNextAction(input: MediaNextActionInput): NextActionPanelConfig {
  if (input.videoStatus === 'error') {
    return {
      statusLabel: 'Needs attention',
      title: 'Select a supported media file',
      detail: 'The selected file could not be processed. Adjust your limits in Settings, or choose a supported video or audio file within the current limits.',
      primaryAction: { label: 'Replace File', onClick: input.chooseFile },
    }
  }

  if (!input.mediaReady) {
    return {
      statusLabel: input.isLoading ? 'Preparing upload' : 'Next step',
      title: input.isLoading ? 'Reviewing the selected file' : 'Add your media',
      detail: input.isLoading
        ? 'VaultClip is checking duration, format, and metadata before processing begins.'
        : 'Choose a video or audio file to begin building grounded context.',
      primaryAction: input.isLoading ? undefined : { label: 'Choose File', onClick: input.chooseFile },
    }
  }

  if (input.isVideoInput && input.audioStatus !== 'ready') {
    return {
      statusLabel: 'Prepare media',
      title: input.isExtractingAudio ? 'Preparing audio for transcription' : 'Create the audio track',
      detail: input.isExtractingAudio
        ? 'Keep this tab open while the browser prepares the local audio track.'
        : 'Create a clean local audio track before transcription begins. Visual sampling can run alongside this step.',
      primaryAction: {
        label: input.isExtractingAudio ? 'Extracting...' : 'Extract Audio',
        onClick: input.extractAudio,
        disabled: input.isExtractingAudio,
      },
      secondaryAction: input.frameSampleCount > 0
        ? undefined
        : {
          label: input.isSamplingFrames ? 'Sampling...' : 'Sample Frames',
          onClick: input.sampleFrames,
          disabled: input.isSamplingFrames || input.isSummarizingFrames,
        },
    }
  }

  if (input.audioStatus === 'ready' && input.transcriptCount === 0) {
    return {
      statusLabel: 'Prepare context',
      title: input.isTranscribing ? 'Transcribing the recording' : 'Create the transcript',
      detail: input.modelReady
        ? 'Generate timestamped transcript segments so answers can cite the exact moment in the recording.'
        : 'Load the local model to begin transcription. The audio is already prepared.',
      primaryAction: {
        label: input.isTranscribing ? 'Transcribing...' : input.modelReady ? 'Transcribe' : 'Load Gemma First',
        onClick: input.transcribe,
        disabled: input.isTranscribing || !input.modelReady,
        title: input.modelReady ? 'Transcribe extracted audio' : 'Load Gemma before transcribing',
      },
      secondaryAction: input.isVideoInput && input.frameSampleCount === 0
        ? {
          label: input.isSamplingFrames ? 'Sampling...' : 'Sample Frames',
          onClick: input.sampleFrames,
          disabled: input.isSamplingFrames || input.isSummarizingFrames,
        }
        : undefined,
    }
  }

  if (input.isVideoInput && input.frameSampleCount === 0) {
    return {
      statusLabel: 'Add visual context',
      title: input.isSamplingFrames ? 'Capturing key frames' : 'Capture key frames',
      detail: 'Collect representative frames so the index includes visual evidence alongside the transcript.',
      primaryAction: {
        label: input.isSamplingFrames ? 'Sampling...' : 'Sample Frames',
        onClick: input.sampleFrames,
        disabled: input.isSamplingFrames || input.isSummarizingFrames,
      },
    }
  }

  if (input.isVideoInput && input.frameSampleCount > 0 && input.frameSummaryCount === 0) {
    return {
      statusLabel: 'Add visual context',
      title: input.isSummarizingFrames ? 'Summarizing visual moments' : 'Summarize visual moments',
      detail: input.modelReady
        ? 'Turn sampled frames into timestamped visual notes that can be retrieved during chat.'
        : 'Load the local model before generating visual summaries.',
      primaryAction: {
        label: input.isSummarizingFrames ? 'Summarizing...' : input.modelReady ? 'Summarize Frames' : 'Load Gemma First',
        onClick: input.summarizeFrames,
        disabled: input.isSummarizingFrames || !input.modelReady || input.frameStatus !== 'ready',
      },
    }
  }

  if (input.transcriptCount > 0 || input.frameSummaryCount > 0) {
    return {
      statusLabel: 'Ready to index',
      title: 'Build the searchable context',
      detail: 'Transcript and visual context are ready. Build the index to enable grounded answers with citations.',
    }
  }

  return {
    statusLabel: 'Ready',
    title: 'Media is prepared',
    detail: 'Continue through the remaining preparation steps, then build the index to start grounded chat.',
  }
}
