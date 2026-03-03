// Direct REST API calls to OpenAI for Sora video generation.
// Sora video generation uses the /v1/images/generations endpoint with model "sora".
// Official docs: https://platform.openai.com/docs/guides/video-generation

const OPENAI_API_BASE = 'https://api.openai.com/v1'

// Changed: Response shape matches the OpenAI images/generations endpoint used for Sora
interface SoraGenerationResponse {
  id: string
  object: string
  created: number
  // Changed: The response includes a data array with generation results
  data?: Array<{
    url?: string
    revised_prompt?: string
    b64_json?: string
  }> | null
  // Changed: For async generation, status tracking fields
  status?: 'queued' | 'in_progress' | 'completed' | 'failed'
  // Changed: Error at top level for failed generations
  error?: {
    message?: string
    type?: string
    code?: string
  } | null
}

// Changed: Response for retrieving a generation by ID
interface SoraRetrieveResponse {
  id: string
  object: string
  created: number
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  data?: Array<{
    url?: string
    revised_prompt?: string
    b64_json?: string
  }> | null
  error?: {
    message?: string
    type?: string
    code?: string
  } | null
}

interface OpenAIErrorResponse {
  error?: {
    message?: string
    type?: string
    param?: string
    code?: string
  }
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      '[Sora] OPENAI_API_KEY environment variable is not set. ' +
      'Please add it in your Vercel/hosting dashboard under Environment Variables. ' +
      'Get your key from https://platform.openai.com/api-keys'
    )
  }
  return apiKey
}

function extractErrorMessage(errorBody: OpenAIErrorResponse, fallback: string): string {
  const err = errorBody?.error
  if (!err) return fallback

  const parts: string[] = []
  if (err.message) parts.push(err.message)
  if (err.type) parts.push(`type=${err.type}`)
  if (err.param) parts.push(`param=${err.param}`)
  if (err.code) parts.push(`code=${err.code}`)

  return parts.length > 0 ? parts.join(' | ') : fallback
}

async function openaiJsonRequest<T>(
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
  } = {}
): Promise<T> {
  const apiKey = getApiKey()
  const { method = 'GET', body } = options

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
    fetchOptions.body = JSON.stringify(body)
  }

  const url = `${OPENAI_API_BASE}${path}`
  console.log(`[Sora] ${method} ${url}`)
  if (body) {
    console.log(`[Sora] Request body:`, JSON.stringify(body, null, 2))
  }

  const res = await fetch(url, fetchOptions)

  if (!res.ok) {
    let errorMessage = `OpenAI API error: ${res.status} ${res.statusText}`
    let rawBody = ''
    try {
      rawBody = await res.text()
      console.error(`[Sora] Error response (${method} ${path}):`, rawBody)
      const errorBody = JSON.parse(rawBody) as OpenAIErrorResponse
      errorMessage = extractErrorMessage(errorBody, errorMessage)
    } catch {
      console.error(`[Sora] Could not parse error body (${method} ${path}):`, rawBody || '(empty)')
    }
    throw new Error(errorMessage)
  }

  const responseText = await res.text()
  console.log(`[Sora] Response (${method} ${path}):`, responseText.slice(0, 500))
  return JSON.parse(responseText) as T
}

// Changed: Map UI size values to OpenAI accepted sizes for Sora
// Sora supports: 1920x1080, 1080x1920, 1280x720, 720x1280, and 1080x1080
function mapSize(size: string): string {
  const sizeMap: Record<string, string> = {
    '1280x720': '1280x720',
    '1920x1080': '1920x1080',
    '480x480': '1080x1080', // Changed: Map square to supported 1080x1080
  }
  return sizeMap[size] ?? '1280x720'
}

// Changed: Use POST /v1/images/generations with model "sora" for video generation.
// This is the correct endpoint per the OpenAI API documentation.
// The response_format should be "url" and we request n=1 outputs.
// Changed: Removed n_seconds — it is NOT a valid parameter for /v1/images/generations.
// The seconds param is kept in the function signature for Cosmic storage but not sent to OpenAI.
export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number; videoUrl?: string }> {
  // Changed: The model name for Sora video generation is just "sora"
  // regardless of whether the UI says "sora-2" or "sora-2-pro"
  const resolvedModel = model === 'sora-2-pro' ? 'sora' : 'sora'

  const mappedSize = mapSize(size)

  // Changed: Only send parameters that the OpenAI API actually accepts.
  // Removed n_seconds — causes "Unknown parameter" error.
  // The API determines video duration automatically.
  const requestBody: Record<string, unknown> = {
    model: resolvedModel,
    prompt: prompt,
    n: 1,
    size: mappedSize,
    response_format: 'url',
  }

  console.log('[Sora] startVideoGeneration with:', JSON.stringify({
    prompt: prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt,
    model: resolvedModel,
    size: mappedSize,
    seconds, // Changed: logged for reference but NOT sent to OpenAI
  }))

  // Changed: POST to /v1/images/generations — this is the unified endpoint for Sora
  const response = await openaiJsonRequest<SoraGenerationResponse>(
    '/images/generations',
    {
      method: 'POST',
      body: requestBody,
    }
  )

  console.log('[Sora] Generation response:', JSON.stringify({
    id: response.id,
    status: response.status,
    hasData: !!(response.data && response.data.length > 0),
    dataLength: response.data?.length ?? 0,
  }))

  // Changed: If the API returns data immediately (synchronous completion), extract URL
  let videoUrl: string | undefined
  if (response.data && response.data.length > 0) {
    const firstResult = response.data[0]
    if (firstResult?.url) {
      videoUrl = firstResult.url
    }
  }

  // Changed: Determine status - if we have data with URL, it's completed
  const status = videoUrl ? 'completed' : (response.status ?? 'queued')

  return {
    id: response.id,
    status,
    progress: status === 'completed' ? 100 : 0,
    videoUrl,
  }
}

// Changed: Use GET /v1/images/generations/{id} to poll status for async generation
export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  videoUrl?: string
  error?: string
}> {
  console.log(`[Sora] getVideoStatus called for: ${videoId}`)

  const video = await openaiJsonRequest<SoraRetrieveResponse>(
    `/images/generations/${encodeURIComponent(videoId)}`
  )

  let progress = 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress') {
    progress = 50
  } else if (video.status === 'queued') {
    progress = 5
  }

  const errorMessage = video.error?.message ?? undefined

  // Changed: Extract video URL from the data array when completed
  let videoUrl: string | undefined
  if (video.status === 'completed' && video.data && video.data.length > 0) {
    const firstResult = video.data[0]
    if (firstResult?.url) {
      videoUrl = firstResult.url
    }
  }

  console.log(`[Sora] Video ${videoId} status: ${video.status}, progress: ${progress}${errorMessage ? `, error: ${errorMessage}` : ''}${videoUrl ? ', has video URL' : ''}`)

  return {
    id: video.id,
    status: video.status,
    progress,
    videoUrl,
    error: errorMessage,
  }
}

// Download video content from a direct URL
export async function downloadVideoFromUrl(videoUrl: string): Promise<Buffer> {
  console.log(`[Sora] Downloading video from URL: ${videoUrl.slice(0, 80)}...`)

  const res = await fetch(videoUrl, {
    redirect: 'follow',
  })

  if (!res.ok) {
    const errorMessage = `Download failed: ${res.status} ${res.statusText}`
    try {
      const rawBody = await res.text()
      console.error(`[Sora] Download error response (HTTP ${res.status}):`, rawBody)
    } catch {
      console.error('[Sora] Could not read download error body')
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await res.arrayBuffer()
  console.log(`[Sora] Downloaded video: ${arrayBuffer.byteLength} bytes`)
  return Buffer.from(arrayBuffer)
}

// Download video by first fetching status to get URL, then downloading
export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  console.log(`[Sora] downloadVideoContent for videoId: ${videoId}`)

  const status = await getVideoStatus(videoId)

  if (status.status !== 'completed') {
    throw new Error(`Video is not yet completed. Current status: ${status.status}`)
  }

  if (!status.videoUrl) {
    throw new Error('Video completed but no download URL available')
  }

  return downloadVideoFromUrl(status.videoUrl)
}

// Download thumbnail - uses the video output as thumbnail source
export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  console.log(`[Sora] downloadThumbnail for videoId: ${videoId}`)

  const video = await openaiJsonRequest<SoraRetrieveResponse>(
    `/images/generations/${encodeURIComponent(videoId)}`
  )

  if (video.status !== 'completed' || !video.data || video.data.length === 0) {
    throw new Error('Video is not completed or has no output for thumbnail')
  }

  const outputUrl = video.data[0]?.url
  if (!outputUrl) {
    throw new Error('No output URL available for thumbnail')
  }

  const res = await fetch(outputUrl, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`Thumbnail download failed: ${res.status} ${res.statusText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  console.log(`[Sora] Downloaded thumbnail ${videoId}: ${arrayBuffer.byteLength} bytes`)
  return Buffer.from(arrayBuffer)
}

// Remix a video by generating a new one with a modified prompt
export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number; videoUrl?: string }> {
  console.log('[Sora] remixVideo called:', {
    originalVideoId: videoId,
    prompt: prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt,
  })

  // Changed: Use the images/generations endpoint for remix as well
  const response = await openaiJsonRequest<SoraGenerationResponse>(
    '/images/generations',
    {
      method: 'POST',
      body: {
        model: 'sora',
        prompt: prompt,
        n: 1,
        size: '1280x720',
        response_format: 'url',
      },
    }
  )

  let videoUrl: string | undefined
  if (response.data && response.data.length > 0) {
    const firstResult = response.data[0]
    if (firstResult?.url) {
      videoUrl = firstResult.url
    }
  }

  const status = videoUrl ? 'completed' : (response.status ?? 'queued')

  console.log('[Sora] Remix created:', { id: response.id, status })

  return {
    id: response.id,
    status,
    progress: status === 'completed' ? 100 : 0,
    videoUrl,
  }
}