'use client'

import { useState, useCallback } from 'react'
import type { VideoModel, VideoSize, VideoSeconds } from '@/types'
import ProgressBar from '@/components/ProgressBar'

type Phase = 'idle' | 'submitting' | 'polling' | 'completed' | 'failed'

interface JobState {
  cosmicId: string
  openaiVideoId: string
  status: string
  progress: number
  prompt: string
}

const EXAMPLE_PROMPTS = [
  'Wide shot of a child flying a red kite in a grassy park, golden hour sunlight, camera slowly pans upward.',
  'Close-up of a steaming coffee cup on a wooden table, morning light through window blinds, soft depth of field.',
  'A timelapse of storm clouds building over a mountain range, lightning flashes in the distance, dramatic music.',
  'Aerial drone shot of a turquoise ocean bay with white sandy beaches, tropical birds in foreground.',
]

export default function GeneratorPanel() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<VideoModel>('sora-2')
  const [size, setSize] = useState<VideoSize>('1280x720')
  const [seconds, setSeconds] = useState<VideoSeconds>('5')
  const [phase, setPhase] = useState<Phase>('idle')
  const [job, setJob] = useState<JobState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollStatus = useCallback(
    async (cosmicId: string, openaiVideoId: string) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/videos/status?openaiVideoId=${openaiVideoId}&cosmicId=${cosmicId}`
          )
          const json = (await res.json()) as {
            data?: { status: string; progress: number; error?: string }
            error?: string
          }

          if (json.error) {
            clearInterval(interval)
            setPhase('failed')
            setError(json.error)
            return
          }

          const data = json.data
          if (!data) return

          setJob((prev) =>
            prev
              ? { ...prev, status: data.status, progress: data.progress }
              : prev
          )

          if (data.status === 'completed') {
            clearInterval(interval)
            setPhase('completed')
          } else if (data.status === 'failed') {
            clearInterval(interval)
            setPhase('failed')
            setError(data.error ?? 'Video generation failed')
          }
        } catch {
          // keep polling
        }
      }, 8000)

      // Cleanup after 20 minutes max
      setTimeout(() => clearInterval(interval), 20 * 60 * 1000)
    },
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || phase === 'submitting' || phase === 'polling') return

    setPhase('submitting')
    setError(null)
    setJob(null)

    try {
      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), model, size, seconds }),
      })
      const json = (await res.json()) as {
        data?: {
          cosmicId: string
          openaiVideoId: string
          status: string
          progress: number
        }
        error?: string
      }

      if (json.error || !json.data) {
        setPhase('failed')
        setError(json.error ?? 'Unknown error')
        return
      }

      const { cosmicId, openaiVideoId, status, progress } = json.data
      setJob({ cosmicId, openaiVideoId, status, progress, prompt: prompt.trim() })
      setPhase('polling')
      pollStatus(cosmicId, openaiVideoId)
    } catch {
      setPhase('failed')
      setError('Network error — please try again')
    }
  }

  const handleDownload = async () => {
    if (!job) return
    const url = `/api/videos/download?openaiVideoId=${job.openaiVideoId}&cosmicId=${job.cosmicId}`
    const a = document.createElement('a')
    a.href = url
    a.download = `sora-video-${job.openaiVideoId}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleShare = async () => {
    if (!job) return
    const shareUrl = `${window.location.origin}?video=${job.openaiVideoId}`
    if (navigator.share) {
      await navigator.share({ title: 'Sora 2 Video', text: job.prompt, url: shareUrl })
    } else {
      await navigator.clipboard.writeText(shareUrl)
      alert('Link copied to clipboard!')
    }
  }

  const handleReset = () => {
    setPhase('idle')
    setJob(null)
    setError(null)
    setPrompt('')
  }

  const isGenerating = phase === 'submitting' || phase === 'polling'

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="text-white font-semibold text-xl mb-1">Generate a Video</h2>
        <p className="text-gray-500 text-sm">
          Describe your scene in detail — subject, camera, lighting, motion.
        </p>
      </div>

      {/* Example prompts */}
      <div>
        <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide">Example prompts</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => setPrompt(p)}
              disabled={isGenerating}
              className="text-xs text-gray-400 bg-surface-elevated border border-surface-border rounded-md px-3 py-1.5 hover:text-white hover:border-brand/50 transition-colors duration-150 text-left line-clamp-1 max-w-xs disabled:opacity-40"
            >
              {p.slice(0, 50)}…
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Wide tracking shot of a teal coupe driving through a desert highway, heat ripples visible, hard sun overhead."
          rows={4}
          maxLength={2000}
          disabled={isGenerating}
          className="input-field resize-none"
        />
        <div className="flex justify-end">
          <span className="text-xs text-gray-600">{prompt.length}/2000</span>
        </div>

        {/* Settings row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as VideoModel)}
              disabled={isGenerating}
              className="input-field text-sm"
            >
              <option value="sora-2">sora-2 (fast)</option>
              <option value="sora-2-pro">sora-2-pro (quality)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Resolution</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as VideoSize)}
              disabled={isGenerating}
              className="input-field text-sm"
            >
              <option value="1280x720">1280×720 (720p)</option>
              <option value="1920x1080">1920×1080 (1080p)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Duration</label>
            <select
              value={seconds}
              onChange={(e) => setSeconds(e.target.value as VideoSeconds)}
              disabled={isGenerating}
              className="input-field text-sm"
            >
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="15">15 seconds</option>
              <option value="20">20 seconds</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin-slow w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              {phase === 'submitting' ? 'Submitting…' : 'Generating…'}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                <polygon points="5,3 19,12 5,21" fill="currentColor" />
              </svg>
              Generate Video
            </>
          )}
        </button>
      </form>

      {/* Status area */}
      {job && (
        <div className="bg-surface-elevated border border-surface-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {phase === 'completed' ? '✅ Generation complete' : '⏳ Rendering…'}
              </p>
              <p className="text-gray-300 text-sm line-clamp-2">{job.prompt}</p>
            </div>
            <StatusBadge status={job.status} />
          </div>

          {phase === 'polling' && (
            <ProgressBar progress={job.progress} status={job.status} />
          )}

          {phase === 'completed' && (
            <div className="flex gap-3">
              <button onClick={handleDownload} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download MP4
              </button>
              <button onClick={handleShare} className="btn-secondary flex items-center gap-2 flex-1 justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
              <button onClick={handleReset} className="btn-secondary px-4">
                New
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 text-red-300 text-sm flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div>
            <p className="font-medium text-red-300 mb-0.5">Generation failed</p>
            <p className="text-red-400">{error}</p>
            <button onClick={handleReset} className="mt-2 text-xs text-red-300 underline hover:no-underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Content restrictions note */}
      <p className="text-gray-600 text-xs">
        ⚠️ Content must be suitable for audiences under 18. No copyrighted characters, real people, or music.
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
    in_progress: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
    completed: 'bg-green-900/50 text-green-300 border-green-800/50',
    failed: 'bg-red-900/50 text-red-300 border-red-800/50',
  }
  const color = colors[status] ?? 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color} capitalize flex-shrink-0`}>
      {status.replace('_', ' ')}
    </span>
  )
}