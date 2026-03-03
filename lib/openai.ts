import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const OPENAI_API_BASE = 'https://api.openai.com/v1'

function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function handleApiResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    let errorMessage = `${context} failed with status ${response.status}`
    try {
      const err = (await response.json()) as { error?: { message?: string } }
      if (err?.error?.message) {
        errorMessage = err.error.message
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage)
  }
  return response.json() as Promise<T>
}

interface SoraVideoResponse {
  id: string
  status: string
  progress?: number
  error?: { message?: string }
}

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  // Changed: Use direct fetch to the correct Sora API endpoint instead of openai.videos.create
  const response = await fetch(`${OPENAI_API_BASE}/video/generations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
      duration: parseInt(seconds, 10),
    }),
  })

  const video = await handleApiResponse<SoraVideoResponse>(response, 'Video generation')

  return {
    id: video.id,
    status: video.status,
    progress: video.progress ?? 0,
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  // Changed: Use direct fetch to the correct Sora status endpoint instead of openai.videos.retrieve
  const response = await fetch(`${OPENAI_API_BASE}/video/generations/${videoId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  const video = await handleApiResponse<SoraVideoResponse>(response, 'Video status')

  return {
    id: video.id,
    status: video.status,
    progress: video.progress ?? 0,
    error: video.error?.message,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  // Changed: Use correct Sora content download endpoint instead of openai.videos.downloadContent
  const response = await fetch(
    `${OPENAI_API_BASE}/video/generations/${videoId}/content/video`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  )

  if (!response.ok) {
    let errorMessage = `Video download failed with status ${response.status}`
    try {
      const err = (await response.json()) as { error?: { message?: string } }
      if (err?.error?.message) {
        errorMessage = err.error.message
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  // Changed: Use correct Sora preview image endpoint instead of openai.videos.downloadContent with variant
  const response = await fetch(
    `${OPENAI_API_BASE}/video/generations/${videoId}/content/preview_image`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  )

  if (!response.ok) {
    let errorMessage = `Thumbnail download failed with status ${response.status}`
    try {
      const err = (await response.json()) as { error?: { message?: string } }
      if (err?.error?.message) {
        errorMessage = err.error.message
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  const response = await fetch(
    `${OPENAI_API_BASE}/video/generations/${videoId}/remix`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
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