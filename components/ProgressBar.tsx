'use client'

interface ProgressBarProps {
  progress: number
  status: string
}

export default function ProgressBar({ progress, status }: ProgressBarProps) {
  const displayProgress = Math.max(0, Math.min(100, progress))
  const isQueued = status === 'queued'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{isQueued ? 'Waiting in queue…' : 'Rendering frames…'}</span>
        <span>{displayProgress.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isQueued
              ? 'bg-yellow-500/70 animate-pulse-slow w-1/3'
              : 'bg-gradient-to-r from-brand to-brand-light'
          }`}
          style={isQueued ? undefined : { width: `${displayProgress}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">
        This may take several minutes. You can leave and come back — your video will be saved.
      </p>
    </div>
  )
}