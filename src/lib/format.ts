/** Formats byte counts for compact UI metadata. */
export function formatFileSize(size: number | null) {
  if (!size) return 'Unknown'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

/** Formats seconds as `m:ss` or `h:mm:ss` for media timestamps. */
export function formatDuration(duration: number | null) {
  if (duration == null || !Number.isFinite(duration) || duration < 0) return 'Unknown'
  const totalSeconds = Math.round(duration)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Formats elapsed seconds for process timing labels. */
export function formatElapsedTime(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return 'Unknown'
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  if (seconds < 60) return `${Math.round(seconds)}s`
  return formatDuration(seconds)
}

/** Clamps chat output tokens to the supported UI/runtime range. */
export function clampTokenLimit(value: number) {
  if (!Number.isFinite(value)) return 128
  return Math.max(32, Math.min(1024, Math.round(value / 32) * 32))
}

/** Clamps configured media size budget in MB. */
export function clampVideoSizeLimit(value: number) {
  if (!Number.isFinite(value)) return 100
  return Math.max(10, Math.min(1000, Math.round(value)))
}

/** Clamps configured media duration budget in minutes. */
export function clampVideoDurationLimit(value: number) {
  if (!Number.isFinite(value)) return 10
  return Math.max(1, Math.min(120, Math.round(value)))
}

/** Clamps transcript chunk length to Gemma's practical audio window. */
export function clampTranscriptChunkSeconds(value: number) {
  if (!Number.isFinite(value)) return 30
  return Math.max(10, Math.min(30, Math.round(value)))
}

/** Clamps transcript overlap so chunks always advance. */
export function clampTranscriptOverlapSeconds(value: number, chunkSeconds: number) {
  if (!Number.isFinite(value)) return 0.1
  const maxOverlap = Math.max(0, chunkSeconds - 0.1)
  return Math.max(0, Math.min(maxOverlap, Math.round(value * 10) / 10))
}

/** Formats audio sample rate for UI labels. */
export function formatAudioSampleRate(sampleRate: number) {
  return sampleRate >= 1000 ? `${sampleRate / 1000} kHz` : `${sampleRate} Hz`
}

/** Clamps frame sampling interval in seconds. */
export function clampFrameIntervalSeconds(value: number) {
  if (!Number.isFinite(value)) return 5
  return Math.max(1, Math.min(30, Math.round(value)))
}

/** Clamps maximum sampled frame count. */
export function clampMaxFrameSamples(value: number) {
  if (!Number.isFinite(value)) return 60
  return Math.max(5, Math.min(120, Math.round(value)))
}

/** Clamps target frame count. */
export function clampTargetFrameCount(value: number) {
  if (!Number.isFinite(value)) return 20
  return Math.max(2, Math.min(100, Math.round(value)))
}

/** Clamps sampled frame max width in pixels. */
export function clampFrameMaxWidth(value: number) {
  if (!Number.isFinite(value)) return 512
  return Math.max(256, Math.min(1280, Math.round(value)))
}

/** Clamps canvas encoding quality for sampled frames. */
export function clampFrameImageQuality(value: number) {
  if (!Number.isFinite(value)) return 0.72
  return Math.max(0.4, Math.min(0.95, Math.round(value * 100) / 100))
}
