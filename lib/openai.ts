// Uses direct fetch to the OpenAI REST API for Sora Videos endpoints,
// since the openai SDK v4.x does not yet expose a .videos property in its types.
// Official docs: https://platform.openai.com/docs/api-reference/video

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return apiKey
}

function getHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  // Resolve model alias: 'sora' → 'sora-2'
  const resolvedModel = model === 'sora' ? 'sora-2' : model

  console.log('[Sora] Creating video via REST API', {
    prompt: prompt.slice(0, 60),
    model: resolvedModel,
    size,
    seconds,
  })

  const response = await fetch('https://api.openai.com/v1/videos/generations', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      prompt,
      model: resolvedModel,
      size,
      n: 1,
      duration: Number(seconds),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as {
    id: string
    status: string
    progress?: number
  }

  console.log('[Sora] Video created:', { id: data.id, status: data.status })

  return {
    id: data.id,
    status: data.status ?? 'queued',
    progress: data.progress ?? 0,
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  const response = await fetch(`https://api.openai.com/v1/videos/generations/${videoId}`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
  }

  const video = (await response.json()) as {
    id: string
    status: string
    progress?: number
    error?: { message?: string }
  }

  // Derive progress from status if not provided numerically
  let progress = video.progress ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress' && progress === 0) {
    progress = 50
  }

  return {
    id: video.id,
    status: video.status,
    progress,
    error: video.error?.message,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.openai.com/v1/videos/generations/${videoId}/content/video`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.openai.com/v1/videos/generations/${videoId}/content/preview`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  const response = await fetch(
    `https://api.openai.com/v1/videos/generations/${videoId}/variations`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
  }

  const video = (await response.json()) as {
    id: string
    status: string
    progress?: number
  }

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}