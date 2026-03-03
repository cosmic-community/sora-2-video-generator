import { createBucketClient } from '@cosmicjs/sdk'
import type { SoraVideo, SoraVideoMetadata, VideoStatus } from '@/types'

export const cosmic = createBucketClient({
  bucketSlug: process.env.COSMIC_BUCKET_SLUG as string,
  readKey: process.env.COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
})

function hasStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error
}

export async function getAllVideos(): Promise<SoraVideo[]> {
  try {
    const response = await cosmic.objects
      .find({ type: 'sora-videos' })
      .props(['id', 'slug', 'title', 'created_at', 'modified_at', 'metadata'])
      .depth(0)
    return response.objects as SoraVideo[]
  } catch (error) {
    if (hasStatus(error) && error.status === 404) return []
    throw new Error('Failed to fetch videos')
  }
}

export async function getVideoById(id: string): Promise<SoraVideo | null> {
  try {
    const response = await cosmic.objects
      .findOne({ type: 'sora-videos', id })
      .props(['id', 'slug', 'title', 'created_at', 'modified_at', 'metadata'])
      .depth(0)
    return response.object as SoraVideo
  } catch (error) {
    if (hasStatus(error) && error.status === 404) return null
    throw new Error('Failed to fetch video')
  }
}

export async function createVideoRecord(
  prompt: string,
  openaiVideoId: string,
  model: string,
  size: string,
  seconds: string
): Promise<SoraVideo> {
  const slug = `sora-${openaiVideoId.slice(-12)}-${Date.now()}`
  const response = await cosmic.objects.insertOne({
    type: 'sora-videos',
    title: prompt.slice(0, 80),
    slug,
    metadata: {
      openai_video_id: openaiVideoId,
      prompt,
      status: 'queued' as VideoStatus,
      model,
      size,
      seconds,
      progress: 0,
    },
  })
  return response.object as SoraVideo
}

export async function updateVideoRecord(
  id: string,
  updates: Partial<SoraVideoMetadata>
): Promise<void> {
  await cosmic.objects.updateOne(id, { metadata: updates })
}

export async function deleteVideoRecord(id: string): Promise<void> {
  await cosmic.objects.deleteOne(id)
}