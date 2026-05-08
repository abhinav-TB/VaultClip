import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { RESET_APP_STATE } from '../store'
import { setVideoError, setVideoLoading, setVideoReady } from '../store/slices/videoSlice'
import { clearAudio, setAudioError, setAudioExtracting, setAudioProgress, setAudioReady } from '../store/slices/audioSlice'
import { setProcessingError, setProcessingProgress, setProcessingStatus } from '../store/slices/processingSlice'
import { createVideoSessionId, getDurationRejection, getFileExtension, getFileSizeRejection, getFileSizeRejectionForBytes, getVideoBudgetWarnings, getVideoWarnings, isSupportedVideo, readVideoDuration, VIDEO_ACCEPT } from '../lib/video'
import { clearVideoFiles, getVideoFile, registerVideoFile } from '../lib/videoFileRegistry'
import { formatAudioSampleRate, formatDuration, formatFileSize } from '../lib/format'
import { GenerationSettings } from '../types/generation'
import { workerClient } from '../services/workerClient'
import { ExtractAudioResult } from '../workers/types'

export const VideoUploadPanel = ({ settings }: { settings: GenerationSettings }) => {
  const dispatch = useAppDispatch()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const activeSessionRef = useRef<string | null>(null)
  const video = useAppSelector((state) => state.video)
  const audio = useAppSelector((state) => state.audio)
  const isReady = video.status === 'ready' && video.fileUrl
  const isLoading = video.status === 'loading-metadata'
  const isExtractingAudio = audio.status === 'extracting'

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
    }
  }, [])

  useEffect(() => {
    if (video.status !== 'ready') return

    const sizeRejection = getFileSizeRejectionForBytes(video.size, settings)
    const durationRejection = getDurationRejection(video.duration, settings)

    if (sizeRejection || durationRejection) {
      revokeActiveObjectUrl()
      activeSessionRef.current = null
      dispatch(setVideoError({
        message: sizeRejection || durationRejection || 'This video exceeds the configured MVP processing budget.',
        name: video.name ?? undefined,
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
  }, [dispatch, settings, video.duration, video.lastModified, video.name, video.sessionId, video.size, video.status, video.type, video.warnings])

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
    dispatch(clearAudio())
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

  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0]
    if (!file) return

    revokeActiveObjectUrl()
    revokeAudioObjectUrl()
    clearVideoFiles()
    activeSessionRef.current = null
    dispatch({ type: RESET_APP_STATE })

    if (!isSupportedVideo(file)) {
      dispatch(setVideoError({
        message: 'Unsupported video format. Use MP4, WebM, Ogg, or MOV.',
        name: file.name,
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
      sessionId,
      fileUrl,
      name: file.name,
      size: file.size,
      type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
      lastModified: file.lastModified,
    }))

    try {
      const duration = await readVideoDuration(fileUrl)
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
          size: file.size,
          type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
          lastModified: file.lastModified,
        }))
        return
      }

      registerVideoFile(sessionId, file)
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
        message: 'This video could not be previewed in the browser. Try a different MP4, WebM, Ogg, or MOV file.',
        name: file.name,
        size: file.size,
        type: file.type || getFileExtension(file.name).toUpperCase().replace('.', ''),
        lastModified: file.lastModified,
      }))
    } finally {
      resetInput()
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    void handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="flex min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={VIDEO_ACCEPT}
        onChange={(event) => event.target.files && void handleFiles(event.target.files)}
      />
      <div className="flex items-start justify-between gap-4 border-b border-gray-800 bg-gray-800/50 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isReady ? 'bg-green-500' : isLoading ? 'bg-yellow-400 animate-pulse' : video.status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`} />
            <span className="text-sm font-semibold text-gray-200">Video</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">One active local file for transcript processing.</p>
        </div>
        <span className="shrink-0 rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {isReady ? 'Ready to process' : isLoading ? 'Reading metadata' : video.status === 'error' ? 'Needs attention' : 'No video'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {!isReady && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-950/60 p-8 text-center transition-colors hover:border-blue-500/70 hover:bg-blue-500/5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <div className="mb-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-blue-300">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
            </div>
            <p className="text-xl font-bold tracking-tight text-gray-100">Select a video to begin</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">
              Drop a short recording here or browse from your computer. The preview loads before any processing starts.
            </p>
            <div className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-blue-500">
              Choose Video
            </div>
            <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              MP4, WebM, Ogg, MOV
            </div>
            <p className="mt-3 text-xs text-gray-600">
              Current budget: {settings.maxVideoSizeMb} MB / {settings.maxVideoDurationMinutes} min
            </p>
          </div>
        )}

        {isLoading && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            Reading video metadata...
          </div>
        )}

        {video.status === 'error' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-red-100">Video was not accepted</p>
            <p className="mt-1 text-sm leading-6 text-red-200/80">{video.error}</p>
            {video.name && (
              <p className="mt-2 text-xs text-red-200/60">
                {video.name} {video.size ? `- ${formatFileSize(video.size)}` : ''}
              </p>
            )}
          </div>
        )}

        {isReady && (
          <>
            <video
              src={video.fileUrl ?? undefined}
              controls
              className="aspect-video w-full rounded-xl border border-gray-800 bg-black object-contain"
            />

            <div className="grid gap-3 rounded-xl border border-gray-800 bg-gray-950/70 p-4 sm:grid-cols-2">
              <VideoMetadataItem label="File" value={video.name ?? 'Unknown'} wide />
              <VideoMetadataItem label="Size" value={formatFileSize(video.size)} />
              <VideoMetadataItem label="Duration" value={formatDuration(video.duration)} />
              <VideoMetadataItem label="Type" value={video.type || 'Unknown'} />
              <VideoMetadataItem label="Session" value={video.sessionId ?? 'Unknown'} />
            </div>

            {video.warnings.length > 0 && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                <p className="text-sm font-semibold text-yellow-100">Near MVP processing limit</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-yellow-100/80">
                  {video.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-100">Transcription audio</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Output: mono {settings.audioFormat.toUpperCase()} at {formatAudioSampleRate(settings.audioSampleRate)}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleExtractAudio()}
                  disabled={isExtractingAudio}
                  className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {audio.status === 'ready' ? 'Extract Again' : isExtractingAudio ? 'Extracting...' : 'Extract Audio'}
                </button>
              </div>

              {isExtractingAudio && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${audio.progress}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-xs text-gray-400">{audio.progress}%</span>
                  </div>
                  <p className="text-xs text-gray-500">{audio.phase ?? 'Extracting audio'}</p>
                </div>
              )}

              {audio.status === 'error' && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm font-semibold text-red-100">Audio extraction failed</p>
                  <p className="mt-1 text-sm leading-6 text-red-200/80">{audio.error}</p>
                </div>
              )}

              {audio.status === 'ready' && audio.objectUrl && (
                <div className="mt-4 space-y-3">
                  <audio src={audio.objectUrl} controls className="w-full" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <VideoMetadataItem label="Audio file" value={audio.fileName ?? 'Unknown'} />
                    <VideoMetadataItem label="Audio size" value={formatFileSize(audio.size)} />
                    <VideoMetadataItem label="Format" value={(audio.format ?? settings.audioFormat).toUpperCase()} />
                    <VideoMetadataItem label="Sample rate" value={formatAudioSampleRate(audio.sampleRate ?? settings.audioSampleRate)} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {(isReady || isLoading || video.status === 'error') && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex-1 rounded-xl border border-blue-500/50 bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500"
            >
              Replace Video
            </button>
            <button
              type="button"
              onClick={resetVideoSession}
              className="rounded-xl border border-gray-700 px-4 py-3 text-sm font-bold text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const VideoMetadataItem = ({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) => (
  <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</div>
    <div className="truncate text-sm text-gray-200" title={value}>
      {value}
    </div>
  </div>
)
