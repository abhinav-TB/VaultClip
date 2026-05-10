export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
export const ACCEPTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov']
export const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/ogg', 'audio/opus', 'audio/webm']
export const ACCEPTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.webm']
export const VIDEO_ACCEPT = `${ACCEPTED_VIDEO_TYPES.join(',')},${ACCEPTED_VIDEO_EXTENSIONS.join(',')},${ACCEPTED_AUDIO_TYPES.join(',')},${ACCEPTED_AUDIO_EXTENSIONS.join(',')}`
export const NEAR_LIMIT_THRESHOLD = 0.8

export interface VideoBudgetSettings {
  maxVideoSizeMb: number
  maxVideoDurationMinutes: number
}

export function isSupportedVideo(file: File) {
  const extension = getFileExtension(file.name)
  return ACCEPTED_VIDEO_TYPES.includes(file.type) || ACCEPTED_VIDEO_EXTENSIONS.includes(extension)
}

export function isSupportedAudio(file: File) {
  const extension = getFileExtension(file.name)
  return ACCEPTED_AUDIO_TYPES.includes(file.type) || ACCEPTED_AUDIO_EXTENSIONS.includes(extension)
}

export function getFileSizeRejection(file: File, settings: VideoBudgetSettings) {
  return getFileSizeRejectionForBytes(file.size, settings)
}

export function getFileSizeRejectionForBytes(size: number | null, settings: VideoBudgetSettings) {
  if (size == null) return null
  const maxBytes = settings.maxVideoSizeMb * 1024 * 1024
  if (size <= maxBytes) return null

  return `This file is ${(size / (1024 * 1024)).toFixed(1)} MB, which exceeds the ${settings.maxVideoSizeMb} MB MVP limit.`
}

export function getDurationRejection(duration: number | null, settings: VideoBudgetSettings) {
  if (duration == null) return null
  const maxSeconds = settings.maxVideoDurationMinutes * 60
  if (duration <= maxSeconds) return null

  return `This file is ${formatVideoBudgetDuration(duration)}, which exceeds the ${settings.maxVideoDurationMinutes} minute MVP limit.`
}

export function getVideoWarnings(file: File, duration: number, settings: VideoBudgetSettings) {
  return getVideoBudgetWarnings(file.size, duration, settings)
}

export function getVideoBudgetWarnings(size: number | null, duration: number | null, settings: VideoBudgetSettings) {
  const warnings: string[] = []
  const maxBytes = settings.maxVideoSizeMb * 1024 * 1024
  const maxSeconds = settings.maxVideoDurationMinutes * 60

  if (size != null && size >= maxBytes * NEAR_LIMIT_THRESHOLD) {
    warnings.push(`File size is near the configured limit (${(size / (1024 * 1024)).toFixed(1)} MB of ${settings.maxVideoSizeMb} MB).`)
  }

  if (duration != null && duration >= maxSeconds * NEAR_LIMIT_THRESHOLD) {
    warnings.push(`Duration is near the configured limit (${formatVideoBudgetDuration(duration)} of ${settings.maxVideoDurationMinutes} min).`)
  }

  return warnings
}

export function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf('.')
  return index >= 0 ? fileName.slice(index).toLowerCase() : ''
}

export function createVideoSessionId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`
}

export function readVideoDuration(fileUrl: string) {
  return new Promise<number>((resolve, reject) => {
    const probe = document.createElement('video')
    const cleanup = () => {
      probe.removeAttribute('src')
      probe.load()
    }

    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      const duration = probe.duration
      cleanup()
      if (Number.isFinite(duration) && duration > 0) {
        resolve(duration)
      } else {
        reject(new Error('Video duration was not available.'))
      }
    }
    probe.onerror = () => {
      cleanup()
      reject(new Error('Video metadata could not be loaded.'))
    }
    probe.src = fileUrl
  })
}

export function readAudioDuration(fileUrl: string) {
  return new Promise<number>((resolve, reject) => {
    const probe = document.createElement('audio')
    const cleanup = () => {
      probe.removeAttribute('src')
      probe.load()
    }

    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      const duration = probe.duration
      cleanup()
      if (Number.isFinite(duration) && duration > 0) {
        resolve(duration)
      } else {
        reject(new Error('Audio duration was not available.'))
      }
    }
    probe.onerror = () => {
      cleanup()
      reject(new Error('Audio metadata could not be loaded.'))
    }
    probe.src = fileUrl
  })
}

function formatVideoBudgetDuration(duration: number) {
  const totalSeconds = Math.round(duration)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
