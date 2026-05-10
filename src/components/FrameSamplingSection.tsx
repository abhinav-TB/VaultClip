import { formatDuration, formatFileSize } from '../lib/format'
import type { FrameSample, FrameSamplingStatus } from '../store/slices/frameSlice'
import type { GenerationSettings } from '../types/generation'

interface FrameSamplingSectionProps {
  status: FrameSamplingStatus
  progress: number
  phase: string | null
  error: string | null
  samples: FrameSample[]
  settings: GenerationSettings
  isSampling: boolean
  onSampleFrames: () => void
}

/** Controls and displays timestamped frame samples for an accepted video. */
export const FrameSamplingSection = ({
  status,
  progress,
  phase,
  error,
  samples,
  settings,
  isSampling,
  onSampleFrames,
}: FrameSamplingSectionProps) => {
  const firstTimestamp = samples[0]?.timestamp ?? null
  const lastTimestamp = samples[samples.length - 1]?.timestamp ?? null

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-100">Frame samples</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Every {settings.frameIntervalSeconds}s, capped at {settings.maxFrameSamples} frames. Output: {settings.frameImageFormat.toUpperCase()} {settings.frameMaxWidth}px at {settings.frameImageQuality.toFixed(2)} quality.
          </p>
        </div>
        <button
          type="button"
          onClick={onSampleFrames}
          disabled={isSampling}
          className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
        >
          {isSampling ? 'Sampling...' : status === 'ready' ? 'Sample Again' : 'Sample Frames'}
        </button>
      </div>

      {isSampling && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="w-10 text-right font-mono text-xs text-gray-400">{progress}%</span>
          </div>
          <p className="text-xs text-gray-500">{phase ?? 'Sampling video frames'}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-red-100">Frame sampling failed</p>
          <p className="mt-1 text-sm leading-6 text-red-200/80">{error}</p>
        </div>
      )}

      {samples.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 rounded-lg border border-gray-800 bg-gray-900/70 p-3 text-sm sm:grid-cols-3">
            <FrameStat label="Frames" value={String(samples.length)} />
            <FrameStat
              label="Coverage"
              value={firstTimestamp == null || lastTimestamp == null ? 'Unknown' : `${formatDuration(firstTimestamp)} - ${formatDuration(lastTimestamp)}`}
            />
            <FrameStat label="Total size" value={formatFileSize(samples.reduce((total, sample) => total + sample.size, 0))} />
          </div>

          <div className="grid max-h-80 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {samples.map((sample) => (
              <figure key={sample.id} className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/80">
                <img src={sample.objectUrl} alt={`Frame at ${formatDuration(sample.timestamp)}`} className="aspect-video w-full bg-black object-contain" />
                <figcaption className="space-y-1 px-3 py-2 text-xs text-gray-500">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-blue-300">{formatDuration(sample.timestamp)}</span>
                    <span>{sample.width}x{sample.height}</span>
                  </div>
                  {Math.abs(sample.timestamp - sample.targetTimestamp) > 0.05 && (
                    <div>Target {formatDuration(sample.targetTimestamp)}</div>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const FrameStat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</div>
    <div className="truncate text-gray-200" title={value}>{value}</div>
  </div>
)
