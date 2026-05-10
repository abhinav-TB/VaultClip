import type { GenerationSettings } from '../types/generation'

export interface SampledFrameBlob {
  index: number
  timestamp: number
  targetTimestamp: number
  blob: Blob
  width: number
  height: number
  mimeType: string
  size: number
}

interface SampleVideoFramesOptions {
  fileUrl: string
  duration: number
  settings: Pick<GenerationSettings, 'frameIntervalSeconds' | 'maxFrameSamples' | 'frameMaxWidth' | 'frameImageFormat' | 'frameImageQuality'>
  onProgress?: (progress: number, phase: string) => void
}

/** Samples compressed video frames with deterministic target timestamps. */
export async function sampleVideoFrames({
  fileUrl,
  duration,
  settings,
  onProgress,
}: SampleVideoFramesOptions): Promise<SampledFrameBlob[]> {
  const targets = buildFrameTargets(duration, settings.frameIntervalSeconds, settings.maxFrameSamples)
  if (targets.length === 0) {
    throw new Error('No usable video duration was available for frame sampling.')
  }

  const video = document.createElement('video')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas rendering is not available in this browser.')
  }

  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'

  try {
    onProgress?.(1, 'Loading video for frame sampling')
    await loadVideoForSampling(video, fileUrl)

    const naturalWidth = video.videoWidth
    const naturalHeight = video.videoHeight
    if (!naturalWidth || !naturalHeight) {
      throw new Error('Video dimensions were not available for frame sampling.')
    }

    const { width, height } = getScaledDimensions(naturalWidth, naturalHeight, settings.frameMaxWidth)
    canvas.width = width
    canvas.height = height

    const mimeType = settings.frameImageFormat === 'webp' ? 'image/webp' : 'image/jpeg'
    const samples: SampledFrameBlob[] = []

    for (let index = 0; index < targets.length; index += 1) {
      const targetTimestamp = targets[index]
      onProgress?.(Math.round((index / targets.length) * 90) + 5, `Sampling frame ${index + 1} of ${targets.length}`)
      await seekVideo(video, targetTimestamp)
      context.drawImage(video, 0, 0, width, height)
      const blob = await encodeCanvas(canvas, mimeType, settings.frameImageQuality)
      samples.push({
        index,
        timestamp: video.currentTime,
        targetTimestamp,
        blob,
        width,
        height,
        mimeType,
        size: blob.size,
      })
    }

    onProgress?.(100, 'Frames ready')
    return samples
  } finally {
    video.removeAttribute('src')
    video.load()
    canvas.width = 0
    canvas.height = 0
  }
}

/** Builds bounded target timestamps that preserve full-video coverage. */
export function buildFrameTargets(duration: number, intervalSeconds: number, maxSamples: number) {
  if (!Number.isFinite(duration) || duration <= 0) return []

  const safeEnd = Math.max(0, duration - 0.05)
  if (safeEnd === 0) return [0]

  const intervalTargets: number[] = []
  for (let timestamp = 0; timestamp <= safeEnd; timestamp += intervalSeconds) {
    intervalTargets.push(roundTimestamp(timestamp))
  }

  if (intervalTargets.length <= maxSamples) {
    return intervalTargets.length > 0 ? intervalTargets : [0]
  }

  if (maxSamples <= 1) return [0]
  return Array.from({ length: maxSamples }, (_, index) => roundTimestamp((safeEnd * index) / (maxSamples - 1)))
}

function loadVideoForSampling(video: HTMLVideoElement, fileUrl: string) {
  return new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('The selected video could not be loaded for frame sampling.'))
    video.src = fileUrl
    video.load()
  })
}

function seekVideo(video: HTMLVideoElement, timestamp: number) {
  return new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - timestamp) < 0.001) {
      window.requestAnimationFrame(() => resolve())
      return
    }

    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out while seeking to ${timestamp.toFixed(2)}s.`))
    }, 8000)

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.onseeked = null
      video.onerror = null
    }

    video.onseeked = () => {
      cleanup()
      resolve()
    }
    video.onerror = () => {
      cleanup()
      reject(new Error(`The browser could not seek to ${timestamp.toFixed(2)}s.`))
    }
    video.currentTime = timestamp
  })
}

function encodeCanvas(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`The browser could not encode sampled frames as ${mimeType}. Try JPEG output.`))
        return
      }
      if (mimeType === 'image/webp' && blob.type !== 'image/webp') {
        reject(new Error('This browser does not support WebP canvas encoding. Use JPEG frame output.'))
        return
      }
      resolve(blob)
    }, mimeType, quality)
  })
}

function getScaledDimensions(width: number, height: number, maxWidth: number) {
  if (width <= maxWidth) return { width, height }
  const scale = maxWidth / width
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function roundTimestamp(value: number) {
  return Math.round(value * 1000) / 1000
}
