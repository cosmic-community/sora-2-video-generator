// Uses the official OpenAI Node.js SDK (openai npm package) for all Sora Videos API calls.
// The SDK handles multipart/form-data encoding, correct endpoints, and auth automatically.
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

  // Changed: Use official SDK openai.videos.create() instead of raw fetch.
  // The SDK sends POST /v1/videos with correct multipart/form-data encoding automatically.
  const video = await openai.videos.create({
    prompt,
    model: resolvedModel,
    // The SDK accepts these as typed parameters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    size: size as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seconds: seconds as any,
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

  // The SDK throws on non-2xx responses, so we only reach here on success
  const errorObj = video as unknown as { error?: { message?: string } }

  return {
    id: video.id,
    status: video.status,
    progress,
    error: errorObj.error?.message,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { variant: 'thumbnail' } as any,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const video = await (openai.videos as any).remix(videoId, { prompt })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}