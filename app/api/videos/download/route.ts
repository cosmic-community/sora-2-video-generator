import { NextRequest, NextResponse } from 'next/server'
import { downloadVideoContent, downloadThumbnail } from '@/lib/openai'
import { updateVideoRecord } from '@/lib/cosmic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const openaiVideoId = searchParams.get('openaiVideoId')
  const cosmicId = searchParams.get('cosmicId')
  const variant = searchParams.get('variant') ?? 'video'
  // Changed: Accept a direct videoUrl parameter to avoid re-fetching
  const directUrl = searchParams.get('videoUrl')

  if (!openaiVideoId && !directUrl) {
    return NextResponse.json({ error: 'openaiVideoId or videoUrl is required' }, { status: 400 })
  }

  try {
    let buffer: Buffer
    let contentType: string
    let filename: string

    if (variant === 'thumbnail') {
      if (!openaiVideoId) {
        return NextResponse.json({ error: 'openaiVideoId is required for thumbnails' }, { status: 400 })
      }
      buffer = await downloadThumbnail(openaiVideoId)
      contentType = 'image/webp'
      filename = `thumbnail-${openaiVideoId}.webp`
    } else {
      // Changed: If a direct URL is provided, download from it; otherwise use the ID-based method
      if (directUrl) {
        const res = await fetch(directUrl, { redirect: 'follow' })
        if (!res.ok) {
          throw new Error(`Failed to download video from URL: ${res.status} ${res.statusText}`)
        }
        const arrayBuffer = await res.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
      } else {
        buffer = await downloadVideoContent(openaiVideoId!)
      }
      contentType = 'video/mp4'
      filename = `sora-video-${openaiVideoId ?? 'download'}.mp4`

      // Update Cosmic with a note that it was downloaded
      if (cosmicId) {
        await updateVideoRecord(cosmicId, { status: 'completed' })
      }
    }

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(buffer)

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    // Changed: Log full error for debugging
    const message = error instanceof Error ? error.message : 'Failed to download'
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[Download API] Error:', message)
    if (stack) {
      console.error('[Download API] Stack:', stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}