export type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed'
// Changed: Correct model names per OpenAI Sora API docs
export type VideoModel = 'sora-2' | 'sora-2-pro'
export type VideoSize = '1280x720' | '1920x1080' | '480x480'
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

// OpenAI Sora Videos API response shape per official docs
export interface OpenAIVideoResponse {
  id: string
  object: string
  created_at: number
  status: VideoStatus
  model: string
  progress?: number
  seconds?: string
  size?: string
  error?: { message: string }
}