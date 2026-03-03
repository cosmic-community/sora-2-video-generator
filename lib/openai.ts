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

interface SoraGenerationResponse {
  id: string
  status: string
  created_at?: number
  data?: Array<{ url?: string }>
  error?: { message?: string }
}

interface SoraStatusResponse {
  id: string
  status: string
  progress?: number
  data?: Array<{ url?: string }>
  error?: { message?: string }
}

// Changed: Parse "1280x720" size string into separate width/height integers
function parseSizeToWidthHeight(size: string): { width: number; height: number } {
  const parts = size.split('x')
  const width = parseInt(parts[0] ?? '1280', 10)
  const height = parseInt(parts[1] ?? '720', 10)
  return { width, height }
}

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  const { width, height } = parseSizeToWidthHeight(size)
  const n_seconds = parseInt(seconds, 10)

  // Changed: Use correct Sora API request body shape with width/height/n_seconds
  // The public Sora API model name is "sora" regardless of UI label
  const body: Record<string, unknown> = {
    model: 'sora',
    prompt,
    width,
    height,
    n_seconds,
    n_variants: 1,
  }

  const response = await fetch(`${OPENAI_API_BASE}/video/generations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })

  const video = await handleApiResponse<SoraGenerationResponse>(response, 'Video generation')

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: 0,
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  const response = await fetch(`${OPENAI_API_BASE}/video/generations/${videoId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  const video = await handleApiResponse<SoraStatusResponse>(response, 'Video status')

  // Changed: Derive progress from status since Sora API may not return a numeric progress field
  let progress = video.progress ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress') {
    progress = progress || 50
  }

  return {
    id: video.id,
    status: video.status,
    progress,
    error: video.error?.message,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  // Changed: Correct Sora content download endpoint
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
    progress?: number
  }
  return { id: video.id, status: video.status, progress: video.progress ?? 0 }
}