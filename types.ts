export type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed'
// Changed: Model type updated — API accepts "sora" as the canonical model name
export type VideoModel = 'sora' | 'sora-2'
export type VideoSize = '1280x720' | '480x480' | '1920x1080'
export type VideoSeconds = '5' | '10' | '15' | '20'

export interface SoraVideoMetadata {
  openai_video_id: string
  prompt: string
  status: VideoStatus
  model: VideoModel
  size?: VideoSize
  seconds?: VideoSeconds
  progress?: number
  thumbnail_url?: string
  video_url?: string
  error_message?: string
  remix_of?: string
}

export interface SoraVideo {
  id: string
  slug: string
  title: string
  created_at: string
  modified_at: string
  metadata: SoraVideoMetadata
}

export interface GenerateVideoRequest {
  prompt: string
  model: VideoModel
  size: VideoSize
  seconds: VideoSeconds
}

export interface RemixVideoRequest {
  prompt: string
  openai_video_id: string
  cosmic_id: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface VideoListResponse {
  videos: SoraVideo[]
  total: number
}

// OpenAI Video API shape (simplified)
export interface OpenAIVideo {
  id: string
  object: string
  created_at: number
  status: VideoStatus
  model: string
  progress?: number
  n_seconds?: number
  width?: number
  height?: number
  data?: Array<{ url?: string }>
  error?: { message: string }
}