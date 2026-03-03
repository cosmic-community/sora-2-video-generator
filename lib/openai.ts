// Uses the official OpenAI Node.js SDK (openai npm package) for all Sora Videos API calls.
// The SDK handles multipart/form-data encoding, correct endpoints, and auth automatically.
// Official docs: https://developers.openai.com/api/docs/guides/video-generation

import OpenAI from 'openai'

// Changed: Define a typed interface for the videos API surface so we get
// type safety while working around the missing property in the SDK's .d.ts files.
interface SoraVideoResult {
  id: string
  status: string
  progress?: number | null
  error?: { message?: string } | null
}

interface SoraVideoContent {
  arrayBuffer(): Promise<ArrayBuffer>
}

interface SoraVideosAPI {
  create(params: Record<string, unknown>): Promise<SoraVideoResult>
  retrieve(videoId: string): Promise<SoraVideoResult>
  downloadContent(videoId: string, options?: Record<string, unknown>): Promise<SoraVideoContent>
  remix(videoId: string, params: Record<string, unknown>): Promise<SoraVideoResult>
}

interface OpenAIWithVideos extends OpenAI {
  videos: SoraVideosAPI
}

function getClient(): OpenAIWithVideos {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  // Changed: Cast to OpenAIWithVideos so TypeScript recognises the videos property
  // which exists at runtime in openai@4.98.0 but is not yet reflected in its .d.ts files.
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

  // Changed: Use official SDK openai.videos.create() instead of raw fetch.
  // The SDK sends POST /v1/videos with correct multipart/form-data encoding automatically.
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
    progress: (video.progress as number) ?? 0,
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  const openai = getClient()

  // Changed: Use official SDK openai.videos.retrieve() — sends GET /v1/videos/{video_id}
  const video = await openai.videos.retrieve(videoId)

  // Derive progress from status if not provided numerically
  let progress = (video.progress as number) ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress' && progress === 0) {
    progress = 50
  }

  return {
    id: video.id,
    status: video.status,
    progress,
    error: video.error?.message ?? undefined,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  const openai = getClient()

  // Changed: Use official SDK openai.videos.downloadContent() — GET /v1/videos/{video_id}/content
  const content = await openai.videos.downloadContent(videoId)

  const arrayBuffer = await content.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const openai = getClient()

  // Changed: Use official SDK with variant=thumbnail query param
  // GET /v1/videos/{video_id}/content?variant=thumbnail
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

  // Changed: Use official SDK for remix — POST /v1/videos/{video_id}/remix with JSON body
  // The SDK handles Content-Type: application/json automatically
  const video = await openai.videos.remix(videoId, { prompt })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}