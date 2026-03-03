import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  // The OpenAI Videos API uses multipart/form-data
  // The SDK handles this via openai.videos.create
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const video = await (openai.videos as any).create({
    model,
    prompt,
    size,
    seconds,
  })
  return {
    id: video.id as string,
    status: video.status as string,
    progress: (video.progress as number) ?? 0,
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const video = await (openai.videos as any).retrieve(videoId)
  return {
    id: video.id as string,
    status: video.status as string,
    progress: (video.progress as number) ?? 0,
    error: video.error?.message as string | undefined,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = await (openai.videos as any).downloadContent(videoId)
  const buffer = Buffer.from(await content.arrayBuffer())
  return buffer
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = await (openai.videos as any).downloadContent(videoId, {
    variant: 'thumbnail',
  })
  const buffer = Buffer.from(await content.arrayBuffer())
  return buffer
}

export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  const response = await fetch(
    `https://api.openai.com/v1/videos/${videoId}/remix`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    }
  )
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? 'Remix failed'
    )
  }
  const video = (await response.json()) as {
    id: string
    status: string
    progress: number
  }
  return { id: video.id, status: video.status, progress: video.progress ?? 0 }
}