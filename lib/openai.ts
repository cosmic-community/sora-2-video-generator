// Uses the official OpenAI Node.js SDK (openai v5+) for all Sora Videos API calls.
// The v5 SDK ships with native openai.videos support — no type-casting needed.
// Official docs: https://developers.openai.com/api/docs/guides/video-generation

import OpenAI from 'openai'

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey })
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

  // Changed: Use official SDK openai.videos.create() — POST /v1/videos
  // In openai v5+ the .videos property and its types are built-in.
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

  // Changed: Use official SDK openai.videos.retrieve() — GET /v1/videos/{video_id}
  const video = await openai.videos.retrieve(videoId)

  // Derive progress from status if not provided numerically
  let progress = (video.progress as number) ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress' && progress === 0) {
    progress = 50
  }

  // Changed: Safely extract error message from response
  const errorObj = video.error as { message?: string } | null | undefined
  const errorMessage = errorObj?.message ?? undefined

  return {
    id: video.id,
    status: video.status,
    progress,
    error: errorMessage,
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

  // Changed: Use official SDK for remix — POST /v1/videos/{video_id}/remix
  const video = await openai.videos.remix(videoId, { prompt })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: (video.progress as number) ?? 0,
  }
}