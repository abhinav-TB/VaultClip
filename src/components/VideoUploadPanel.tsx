import { useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { RESET_APP_STATE } from '../store'
import { setVideoError, setVideoLoading, setVideoReady, type MediaKind } from '../store/slices/videoSlice'
import { clearAudio, setAudioError, setAudioExtracting, setAudioProgress, setAudioReady } from '../store/slices/audioSlice'
import { setProcessingError, setProcessingProgress, setProcessingStatus } from '../store/slices/processingSlice'
import { appendTranscriptSegments, clearContext, setTranscriptError, setTranscriptPhase, setTranscriptProgress, setTranscriptResult, setTranscriptTranscribing } from '../store/slices/contextSlice'
import { createVideoSessionId, getDurationRejection, getFileExtension, getFileSizeRejection, getFileSizeRejectionForBytes, getVideoBudgetWarnings, getVideoWarnings, isSupportedAudio, isSupportedVideo, readAudioDuration, readVideoDuration } from '../lib/video'
import { clearAudioData, getAudioData, registerAudioData } from '../lib/audioDataRegistry'
import { clearVideoFiles, getVideoFile, registerVideoFile } from '../lib/videoFileRegistry'
import { getMediaNextAction } from '../lib/workflowUi'
import type { GenerationSettings } from '../types/generation'
import { workerClient } from '../services/workerClient'
import type { ExtractAudioResult, TranscribePartialResult, TranscribeResult } from '../workers/types'
import { HiddenMediaInput, LoadingMetadataNotice, MediaDropZone, MediaErrorNotice, MediaPanelHeader, NextActionPanel, PanelActions } from './VideoUploadPanelSections'
import { MediaReadySections } from './MediaReadySections'
import { NormalIngestPanel } from './NormalIngestPanel'
import { NormalMediaSummary } from './NormalMediaSummary'
import { useFrameSampling } from '../store/hooks/useFrameSampling'
import { useFrameSummaries } from '../store/hooks/useFrameSummaries'
import { useNormalIngest } from '../store/hooks/useNormalIngest'
import { useWorker } from '../store/hooks/useWorker'
export const VideoUploadPanel = ({ settings }: { settings: GenerationSettings }) => {
  const dispatch = useAppDispatch()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const activeSessionRef = useRef<string | null>(null)
  const [audioOnlyIndex, setAudioOnlyIndex] = useState(false)
  const video = useAppSelector((state) => state.video)
  const audio = useAppSelector((state) => state.audio)
  const transcript = useAppSelector((state) => state.context)
  const model = useAppSelector((state) => state.model)
  const ragReady = useAppSelector((state) => state.rag.status === 'ready')
  const modelStatus = model.status
  const isReady = video.status === 'ready' && video.fileUrl
  const isAudioInput = video.mediaKind === 'audio'; const isVideoInput = video.mediaKind === 'video'
  const isLoading = video.status === 'loading-metadata'
  const isExtractingAudio = audio.status === 'extracting'
  const isTranscribing = transcript.transcriptStatus === 'transcribing'
  const modelReady = modelStatus === 'ready'
  const isPowerMode = settings.experienceMode === 'power'
  const { loadModel } = useWorker()
  const { frames, isSamplingFrames, sampleFrames, clearFrameArtifacts, registerSampledFrames } = useFrameSampling(settings, activeSessionRef)
  const { isSummarizingFrames, summarizeFrames } = useFrameSummaries(activeSessionRef, settings)
  const normalIngest = useNormalIngest(settings, activeSessionRef, (objectUrl) => {
    audioObjectUrlRef.current = objectUrl
  }, clearFrameArtifacts, registerSampledFrames, audioOnlyIndex || isAudioInput)
  const nextAction = getMediaNextAction({
    mediaReady: Boolean(isReady),
    isLoading,
    isVideoInput,
    videoStatus: video.status,
    audioStatus: audio.status,
    transcriptCount: transcript.transcriptSegments.length,
    frameSampleCount: frames.samples.length,
    frameSummaryCount: frames.summaries.length,
    frameStatus: frames.status,
    modelReady,
    isExtractingAudio,
    isTranscribing,
    isSamplingFrames,
    isSummarizingFrames,
    chooseFile: () => inputRef.current?.click(),
    extractAudio: () => void handleExtractAudio(),
    sampleFrames: () => void sampleFrames(),
    summarizeFrames: () => void summarizeFrames(),
    transcribe: () => void handleTranscribe(),
  })
  useEffect(() => {
    objectUrlRef.current = video.fileUrl
  }, [video.fileUrl])
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current)
      }
      clearVideoFiles()
      clearAudioData()
      clearFrameArtifacts()
    }
  }, [clearFrameArtifacts])
  useEffect(() => {
    if (video.status !== 'ready') return
    const sizeRejection = getFileSizeRejectionForBytes(video.size, settings)
    const durationRejection = getDurationRejection(video.duration, settings)
    if (sizeRejection || durationRejection) {
      revokeActiveObjectUrl()
      revokeAudioObjectUrl()
      clearAudioData()
      clearVideoFiles()
      clearFrameArtifacts()
      activeSessionRef.current = null
      dispatch(clearAudio())
      dispatch(clearContext())
      dispatch(setVideoError({
        message: sizeRejection || durationRejection || 'This video exceeds the configured MVP processing budget.',
        name: video.name ?? undefined,
        mediaKind: video.mediaKind ?? undefined,
        size: video.size ?? undefined,
        type: video.type ?? undefined,
        lastModified: video.lastModified ?? undefined,
      }))
      return
    }
    const warnings = getVideoBudgetWarnings(video.size, video.duration, settings)
    if (warnings.join('|') !== video.warnings.join('|') && video.sessionId) {
      dispatch(setVideoReady({
        sessionId: video.sessionId,
        duration: video.duration ?? 0,
        warnings,
      }))
    }
  }, [clearFrameArtifacts, dispatch, settings, video.duration, video.lastModified, video.mediaKind, video.name, video.sessionId, video.size, video.status, video.type, video.warnings])
  const revokeActiveObjectUrl = () => {
    const activeUrl = objectUrlRef.current
    if (activeUrl) {
      URL.revokeObjectURL(activeUrl)
      objectUrlRef.current = null
    }
  }
  const revokeAudioObjectUrl = () => {
    const activeUrl = audioObjectUrlRef.current
    if (activeUrl) {
      URL.revokeObjectURL(activeUrl)
      audioObjectUrlRef.current = null
    }
  }
  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }
  const resetVideoSession = () => {
    activeSessionRef.current = null
    revokeActiveObjectUrl()
    revokeAudioObjectUrl()
    clearVideoFiles()
    clearAudioData()
    clearFrameArtifacts()
    setAudioOnlyIndex(false)
    resetInput()
    dispatch({ type: RESET_APP_STATE })
  }
  const handleExtractAudio = async () => {
    if (!video.sessionId || video.status !== 'ready' || isExtractingAudio) return
    const file = getVideoFile(video.sessionId)
    if (!file) {
      dispatch(setAudioError({
        sessionId: video.sessionId,
        message: 'The selected video file is no longer available in browser memory. Replace the video and try again.',
      }))
      return
    }
    revokeAudioObjectUrl()
    if (video.sessionId) {
      clearAudioData()
    }
    dispatch(clearAudio())
    dispatch(clearContext())
    dispatch(setAudioExtracting({
      sessionId: video.sessionId,
      format: settings.audioFormat,
      sampleRate: settings.audioSampleRate,
      duration: video.duration,
    }))
    dispatch(setProcessingStatus('extracting-audio'))
    dispatch(setProcessingProgress(0))
    dispatch(setProcessingError(''))
    try {
      const result = await workerClient.runTask<ExtractAudioResult>('EXTRACT_AUDIO', {
        sessionId: video.sessionId,
        file,
        inputName: video.name ?? file.name,
        outputFormat: settings.audioFormat,
        sampleRate: settings.audioSampleRate,
      }, (progress) => {
        dispatch(setAudioProgress({
          progress,
          phase: progress < 15 ? 'Loading ffmpeg' : progress < 96 ? 'Extracting audio' : 'Finalizing audio',
        }))
        dispatch(setProcessingProgress(progress))
      }, (log) => {
        if (typeof log === 'string') {
          dispatch(setAudioProgress({
            progress: audio.progress,
            phase: log,
          }))
        }
      })
      if (activeSessionRef.current !== result.sessionId) return
      const audioBytes: Uint8Array<ArrayBuffer> = new Uint8Array(result.bytes.byteLength)
      audioBytes.set(result.bytes)
      const blob = new Blob([audioBytes.buffer], { type: result.mimeType })
      const objectUrl = URL.createObjectURL(blob)
      audioObjectUrlRef.current = objectUrl
      registerAudioData(result.sessionId, {
        bytes: result.bytes,
        mimeType: result.mimeType,
        sampleRate: result.sampleRate,
        duration: video.duration,
      })
      dispatch(setAudioReady({
        sessionId: result.sessionId,
        objectUrl,
        format: result.format,
        sampleRate: result.sampleRate,
        channels: result.channels,
        duration: video.duration,
        size: result.size,
        fileName: result.fileName,
        mimeType: result.mimeType,
      }))
      dispatch(setProcessingStatus('complete'))
      dispatch(setProcessingProgress(100))
    } catch (err) {
      if (activeSessionRef.current !== video.sessionId) return
      const message = err instanceof Error ? err.message : 'Audio extraction failed.'
      dispatch(setAudioError({
        sessionId: video.sessionId,
        message,
      }))
      dispatch(setProcessingError(message))
      dispatch(setProcessingStatus('idle'))
    }
  }
  const handleTranscribe = async () => {
    if (!video.sessionId || audio.status !== 'ready' || isTranscribing || !modelReady) return
    const audioData = getAudioData(video.sessionId)
    if (!audioData) {
      dispatch(setTranscriptError('The extracted audio is no longer available in browser memory. Extract audio again and retry transcription.'))
      return
    }
    dispatch(setTranscriptTranscribing())
    dispatch(setProcessingStatus('transcribing'))
    dispatch(setProcessingProgress(0))
    dispatch(setProcessingError(''))
    try {
      const result = await workerClient.runTask<TranscribeResult>('TRANSCRIBE', {
        sessionId: video.sessionId,
        bytes: audioData.bytes,
        mimeType: audioData.mimeType,
        sampleRate: audioData.sampleRate,
        duration: audioData.duration,
        maxNewTokens: settings.transcriptMaxNewTokens,
        chunkSeconds: settings.transcriptChunkSeconds,
        overlapSeconds: settings.transcriptOverlapSeconds,
      }, (progress) => {
        dispatch(setTranscriptProgress(progress))
        dispatch(setProcessingProgress(progress))
      }, (log) => {
        if (typeof log === 'string') {
          dispatch(setTranscriptPhase(log))
        }
      }, (partial) => {
        const partialResult = partial as TranscribePartialResult
        if (partialResult.sessionId === video.sessionId) {
          dispatch(appendTranscriptSegments({
            segments: partialResult.segments,
            rawText: partialResult.rawText,
          }))
        }
      })
      if (activeSessionRef.current !== result.sessionId) return
      dispatch(setTranscriptResult({
        segments: result.segments,
        rawText: result.rawText,
        warnings: result.warnings,
      }))
      dispatch(setProcessingStatus('complete'))
      dispatch(setProcessingProgress(100))
      dispatch(setProcessingError(''))
    } catch (err) {
      if (activeSessionRef.current !== video.sessionId) return
      const message = err instanceof Error ? err.message : 'Transcription failed.'
      dispatch(setTranscriptError(message))
      dispatch(setProcessingError(message))
      dispatch(setProcessingStatus('idle'))
    }
  }
  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0]
    if (!file) return
    const mediaKind: MediaKind | null = isSupportedVideo(file) ? 'video' : isSupportedAudio(file) ? 'audio' : null
    revokeActiveObjectUrl()
    revokeAudioObjectUrl()
    clearVideoFiles()
    clearAudioData()
    clearFrameArtifacts()
    setAudioOnlyIndex(mediaKind === 'audio')
    activeSessionRef.current = null
    dispatch({ type: RESET_APP_STATE })
    if (!mediaKind) {
      dispatch(setVideoError({
        message: 'Unsupported file format. Use video files like MP4/WebM/MOV or audio files like MP3/WAV/M4A/FLAC/Ogg.',
        name: file.name,
        mediaKind: null,
        size: file.size,
        type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
        lastModified: file.lastModified,
      }))
      resetInput()
      return
    }
    const sizeRejection = getFileSizeRejection(file, settings)
    if (sizeRejection) {
      dispatch(setVideoError({
        message: sizeRejection,
        name: file.name,
        mediaKind,
        size: file.size,
        type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
        lastModified: file.lastModified,
      }))
      resetInput()
      return
    }
    const sessionId = createVideoSessionId(file)
    const fileUrl = URL.createObjectURL(file)
    activeSessionRef.current = sessionId
    objectUrlRef.current = fileUrl
    dispatch(setVideoLoading({
      mediaKind,
      sessionId,
      fileUrl,
      name: file.name,
      size: file.size,
      type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
      lastModified: file.lastModified,
    }))
    try {
      const duration = mediaKind === 'video' ? await readVideoDuration(fileUrl) : await readAudioDuration(fileUrl)
      if (activeSessionRef.current !== sessionId) return
      const durationRejection = getDurationRejection(duration, settings)
      if (durationRejection) {
        URL.revokeObjectURL(fileUrl)
        if (objectUrlRef.current === fileUrl) {
          objectUrlRef.current = null
        }
        activeSessionRef.current = null
        clearVideoFiles()
        dispatch(setVideoError({
          message: durationRejection,
          name: file.name,
          mediaKind,
          size: file.size,
          type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
          lastModified: file.lastModified,
        }))
        return
      }
      if (mediaKind === 'video') {
        registerVideoFile(sessionId, file)
      } else {
        const audioUrl = URL.createObjectURL(file)
        audioObjectUrlRef.current = audioUrl
        const bytes = new Uint8Array(await file.arrayBuffer())
        registerAudioData(sessionId, {
          bytes,
          mimeType: file.type || 'audio/*',
          sampleRate: settings.audioSampleRate,
          duration,
        })
        dispatch(setAudioReady({
          sessionId,
          objectUrl: audioUrl,
          format: 'source',
          sampleRate: settings.audioSampleRate,
          channels: 1,
          duration,
          size: file.size,
          fileName: file.name,
          mimeType: file.type || 'audio/*',
        }))
      }
      dispatch(setVideoReady({
        sessionId,
        duration,
        warnings: getVideoWarnings(file, duration, settings),
      }))
    } catch {
      if (activeSessionRef.current !== sessionId) return
      URL.revokeObjectURL(fileUrl)
      if (objectUrlRef.current === fileUrl) {
        objectUrlRef.current = null
      }
      clearVideoFiles()
      dispatch(setVideoError({
        message: mediaKind === 'video'
          ? 'This video could not be previewed in the browser. Try a different MP4, WebM, Ogg, or MOV file.'
          : 'This audio file could not be previewed in the browser. Try a different MP3, WAV, M4A, FLAC, or Ogg file.',
        name: file.name,
        mediaKind,
        size: file.size,
        type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
        lastModified: file.lastModified,
      }))
    } finally {
      resetInput()
    }
  }
  return (
    <div className="flex min-h-[560px] w-full flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900 shadow-2xl lg:h-full lg:min-h-0">
      <HiddenMediaInput inputRef={inputRef} onFiles={(files) => void handleFiles(files)} />
      <MediaPanelHeader isReady={Boolean(isReady)} isLoading={isLoading} status={video.status} />
      <div className="flex flex-1 flex-col gap-4 p-5 lg:min-h-0 lg:overflow-y-auto">
        {isPowerMode && isReady && <NextActionPanel {...nextAction} />}
        {!isReady && (
          <MediaDropZone
            settings={settings}
            onChoose={() => inputRef.current?.click()}
            onFiles={(files) => void handleFiles(files)}
          />
        )}
        {isLoading && <LoadingMetadataNotice />}
        {video.status === 'error' && (
          <MediaErrorNotice error={video.error} name={video.name} size={video.size} />
        )}
        {isReady && !isPowerMode && (
          <>
            <NormalIngestPanel
              modelStatus={model.status}
              modelProgress={model.progress}
              modelError={model.error}
              buildRunning={normalIngest.running}
              buildPhase={normalIngest.phase}
              buildProgress={normalIngest.progress}
              buildError={normalIngest.error}
              ragReady={ragReady}
              audioOnlyIndex={audioOnlyIndex || isAudioInput}
              audioOnlyLocked={isAudioInput}
              onAudioOnlyIndexChange={setAudioOnlyIndex}
              onLoadModel={() => void loadModel().catch(() => undefined)}
              onBuildIndex={() => void normalIngest.buildIndex()}
            />
            <NormalMediaSummary
              mediaKind={video.mediaKind}
              fileUrl={video.fileUrl}
              name={video.name}
              size={video.size}
              duration={video.duration}
              type={video.type}
              sessionId={video.sessionId}
              warnings={video.warnings}
            />
          </>
        )}
        {isReady && isPowerMode && (
          <MediaReadySections
            mediaKind={video.mediaKind}
            fileUrl={video.fileUrl}
            name={video.name}
            size={video.size}
            duration={video.duration}
            type={video.type}
            sessionId={video.sessionId}
            warnings={video.warnings}
            isAudioInput={isAudioInput}
            isVideoInput={isVideoInput}
            settings={settings}
            modelReady={modelReady}
            audio={audio}
            transcript={{
              status: transcript.transcriptStatus,
              progress: transcript.transcriptProgress,
              phase: transcript.transcriptPhase,
              error: transcript.transcriptError,
              warnings: transcript.transcriptWarnings,
              segments: transcript.transcriptSegments,
              isTranscribing,
            }}
            frames={{
              ...frames,
              isSampling: isSamplingFrames,
              isSummarizing: isSummarizingFrames,
            }}
            onExtractAudio={() => void handleExtractAudio()}
            onSampleFrames={() => void sampleFrames()}
            onSummarizeFrames={() => void summarizeFrames()}
            onTranscribe={() => void handleTranscribe()}
          />
        )}
        {(isReady || isLoading || video.status === 'error') && (
          <PanelActions onReplace={() => inputRef.current?.click()} onReset={resetVideoSession} />
        )}
      </div>
    </div>
  )
}
