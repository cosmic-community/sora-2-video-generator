// Uses the official OpenAI Node.js SDK (openai v5+) for all Sora Videos API calls.
// The v5 SDK runtime supports openai.videos but the TypeScript definitions
// have not yet been published. We use a typed cast to bypass TS2339 errors.
// Official docs: https://developers.openai.com/api/docs/guides/video-generation

import OpenAI from 'openai'

// Changed: Define an interface for the videos namespace that the SDK supports at runtime
// but hasn't yet exported in its TypeScript declarations.
interface SoraVideoResponse {
  id: string
  status: string
  progress?: number
  error?: { message?: string } | null
}

interface SoraVideosNamespace {
  create(params: {
    prompt: string
    model: string
    size: string
    seconds: string
  }): Promise<SoraVideoResponse>
  retrieve(videoId: string): Promise<SoraVideoResponse>
  downloadContent(
    videoId: string,
    options?: { query?: { variant?: string } }
  ): Promise<Response>
  remix(
    videoId: string,
    params: { prompt: string }
  ): Promise<SoraVideoResponse>
}

// Changed: Extend OpenAI with the videos namespace for type safety
interface OpenAIWithVideos extends OpenAI {
  videos: SoraVideosNamespace
}

function getClient(): OpenAIWithVideos {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  // Changed: Cast to OpenAIWithVideos since the runtime supports .videos
  return new OpenAI({ apiKey }) as OpenAIWithVideos
}

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  const openai = getClient()

  // Resolve model alias: 'sora' → 'sora-2'
  const resolvedModel = model === 'sora' ? 'sora-2' : model

  console.log('[Sora] Creating video via SDK', {
    prompt: prompt.slice(0, 60),
    model: resolvedModel,
    size,
    seconds,
  })

  // Changed: Now type-safe via OpenAIWithVideos interface
  const video = await openai.videos.create({
    prompt,
    model: resolvedModel,
    size,
    seconds,
  })

  console.log('[Sora] Video created:', { id: video.id, status: video.status })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  const openai = getClient()

  // Changed: Now type-safe via OpenAIWithVideos interface
  const video = await openai.videos.retrieve(videoId)

  // Derive progress from status if not provided numerically
  let progress = video.progress ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress' && progress === 0) {
    progress = 50
  }

  // Changed: Safely extract error message from response
  const errorMessage = video.error?.message ?? undefined

  return {
    id: video.id,
    status: video.status,
    progress,
    error: errorMessage,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  const openai = getClient()

  // Changed: Now type-safe via OpenAIWithVideos interface
  const content = await openai.videos.downloadContent(videoId)

  const arrayBuffer = await content.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const openai = getClient()

  // Changed: Now type-safe via OpenAIWithVideos interface
  const content = await openai.videos.downloadContent(videoId, {
    query: { variant: 'thumbnail' },
  })

  const arrayBuffer = await content.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  const openai = getClient()

  // Changed: Now type-safe via OpenAIWithVideos interface
  const video = await openai.videos.remix(videoId, { prompt })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}