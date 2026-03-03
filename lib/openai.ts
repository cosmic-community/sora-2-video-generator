// Direct REST API calls to OpenAI for Sora video generation.
// The Sora model is accessed via POST /v1/images/generations with model "sora".
// ONLY accepted parameters: model, prompt, size.
// All other parameters (n, n_seconds, response_format, quality, etc.) are REJECTED by the API.
// Docs: https://platform.openai.com/docs/guides/video-generation

const OPENAI_API_BASE = 'https://api.openai.com/v1'

interface OpenAIErrorResponse {
  error?: {
    message?: string
    type?: string
    param?: string
    code?: string
  }
}

// Changed: Flexible response shape — Sora can return sync (with data[]) or async (with status)
interface SoraResponse {
  id: string
  object?: string
  created?: number
  status?: string
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

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      '[Sora] OPENAI_API_KEY is not set. Add it to your environment variables. ' +
        'Get your key at https://platform.openai.com/api-keys'
    )
  }
  return apiKey
}

function extractError(body: OpenAIErrorResponse, fallback: string): string {
  const err = body?.error
  if (!err) return fallback
  const parts: string[] = []
  if (err.message) parts.push(err.message)
  if (err.type) parts.push(`type=${err.type}`)
  if (err.param) parts.push(`param=${err.param}`)
  if (err.code) parts.push(`code=${err.code}`)
  return parts.length > 0 ? parts.join(' | ') : fallback
}

// Changed: Minimal HTTP helper — reads body once as text to avoid stream errors
async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<T> {
  const apiKey = getApiKey()
  const { method = 'GET', body } = options
  const url = `${OPENAI_API_BASE}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }
  const init: RequestInit = { method, headers }

  if (body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
    console.log(`[Sora] ${method} ${url}`, JSON.stringify(body))
  } else {
    console.log(`[Sora] ${method} ${url}`)
  }

  const res = await fetch(url, init)
  const rawText = await res.text()

  if (!res.ok) {
    console.error(`[Sora] HTTP ${res.status} ${res.statusText}:`, rawText)
    let msg = `OpenAI API error: ${res.status} ${res.statusText}`
    try {
      const parsed = JSON.parse(rawText) as OpenAIErrorResponse
      msg = extractError(parsed, msg)
    } catch {
      // raw text already logged above
    }
    throw new Error(msg)
  }

  console.log(`[Sora] Response:`, rawText.slice(0, 600))
  return JSON.parse(rawText) as T
}

// Changed: Map UI sizes to Sora-supported sizes
// Sora supports: 1920x1080, 1080x1920, 1280x720, 720x1280, 1080x1080
function resolveSize(size: string): string {
  const map: Record<string, string> = {
    '1920x1080': '1920x1080',
    '1280x720': '1280x720',
    '480x480': '1080x1080',
  }
  return map[size] ?? '1280x720'
}

// ---------------------------------------------------------------------------
// Generate — sends ONLY model, prompt, size. Nothing else.
// ---------------------------------------------------------------------------
// Changed: Every other parameter (n, n_seconds, response_format) was rejected by OpenAI.
// The "seconds" param is kept in the signature for Cosmic storage but NOT sent to OpenAI.
export async function startVideoGeneration(
  prompt: string,
  _model: string,
  size: string,
  _seconds: string
): Promise<{ id: string; status: string; progress: number; videoUrl?: string }> {
  const mappedSize = resolveSize(size)

  console.log('[Sora] startVideoGeneration:', {
    prompt: prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt,
    size: mappedSize,
  })

  // Changed: Absolute minimum payload — only what OpenAI accepts
  const response = await apiRequest<SoraResponse>('/images/generations', {
    method: 'POST',
    body: {
      model: 'sora',
      prompt,
      size: mappedSize,
    },
  })

  // Changed: Determine completion from response shape
  let videoUrl: string | undefined
  if (response.data && response.data.length > 0 && response.data[0]?.url) {
    videoUrl = response.data[0].url
  }

  const status = videoUrl
    ? 'completed'
    : typeof response.status === 'string'
      ? response.status
      : 'queued'

  console.log('[Sora] Generation started:', {
    id: response.id,
    status,
    hasUrl: !!videoUrl,
  })

  return {
    id: response.id,
    status,
    progress: status === 'completed' ? 100 : 0,
    videoUrl,
  }
}

// ---------------------------------------------------------------------------
// Poll status
// ---------------------------------------------------------------------------
export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  videoUrl?: string
  error?: string
}> {
  console.log(`[Sora] Polling status for ${videoId}`)

  const video = await apiRequest<SoraResponse>(
    `/images/generations/${encodeURIComponent(videoId)}`
  )

  const rawStatus =
    typeof video.status === 'string' ? video.status : 'unknown'

  let progress = 0
  if (rawStatus === 'completed') progress = 100
  else if (rawStatus === 'in_progress') progress = 50
  else if (rawStatus === 'queued') progress = 5

  let videoUrl: string | undefined
  if (
    rawStatus === 'completed' &&
    video.data &&
    video.data.length > 0 &&
    video.data[0]?.url
  ) {
    videoUrl = video.data[0].url
  }

  const errorMsg = video.error?.message ?? undefined

  console.log(
    `[Sora] Status ${videoId}: ${rawStatus}, progress=${progress}${videoUrl ? ', hasUrl' : ''}${errorMsg ? `, error=${errorMsg}` : ''}`
  )

  return {
    id: video.id,
    status: rawStatus,
    progress,
    videoUrl,
    error: errorMsg,
  }
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------
export async function downloadVideoFromUrl(
  videoUrl: string
): Promise<Buffer> {
  console.log(`[Sora] Downloading from: ${videoUrl.slice(0, 80)}...`)
  const res = await fetch(videoUrl, { redirect: 'follow' })
  if (!res.ok)
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const ab = await res.arrayBuffer()
  console.log(`[Sora] Downloaded ${ab.byteLength} bytes`)
  return Buffer.from(ab)
}

export async function downloadVideoContent(
  videoId: string
): Promise<Buffer> {
  const status = await getVideoStatus(videoId)
  if (status.status !== 'completed')
    throw new Error(`Video not completed: ${status.status}`)
  if (!status.videoUrl) throw new Error('No video URL available')
  return downloadVideoFromUrl(status.videoUrl)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  // Changed: Sora doesn't have a separate thumbnail endpoint — reuse video URL
  const status = await getVideoStatus(videoId)
  if (!status.videoUrl) throw new Error('No URL available for thumbnail')
  const res = await fetch(status.videoUrl, { redirect: 'follow' })
  if (!res.ok)
    throw new Error(`Thumbnail download failed: ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

// ---------------------------------------------------------------------------
// Remix (new generation with different prompt)
// ---------------------------------------------------------------------------
export async function remixVideo(
  _videoId: string,
  prompt: string
): Promise<{
  id: string
  status: string
  progress: number
  videoUrl?: string
}> {
  console.log('[Sora] Remix:', { prompt: prompt.slice(0, 80) })

  // Changed: Same minimal payload — just model, prompt, size
  const response = await apiRequest<SoraResponse>('/images/generations', {
    method: 'POST',
    body: {
      model: 'sora',
      prompt,
      size: '1280x720',
    },
  })

  let videoUrl: string | undefined
  if (response.data && response.data.length > 0 && response.data[0]?.url) {
    videoUrl = response.data[0].url
  }

  const status = videoUrl
    ? 'completed'
    : typeof response.status === 'string'
      ? response.status
      : 'queued'

  return {
    id: response.id,
    status,
    progress: status === 'completed' ? 100 : 0,
    videoUrl,
  }
}