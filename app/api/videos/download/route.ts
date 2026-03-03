import { NextRequest, NextResponse } from 'next/server'
import { downloadVideoContent, downloadThumbnail } from '@/lib/openai'
import { updateVideoRecord } from '@/lib/cosmic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const openaiVideoId = searchParams.get('openaiVideoId')
  const cosmicId = searchParams.get('cosmicId')
  const variant = searchParams.get('variant') ?? 'video'

  if (!openaiVideoId) {
    return NextResponse.json({ error: 'openaiVideoId is required' }, { status: 400 })
  }

  try {
    let buffer: Buffer
    let contentType: string
    let filename: string

    if (variant === 'thumbnail') {
      buffer = await downloadThumbnail(openaiVideoId)
      contentType = 'image/webp'
      filename = `thumbnail-${openaiVideoId}.webp`
    } else {
      buffer = await downloadVideoContent(openaiVideoId)
      contentType = 'video/mp4'
      filename = `sora-video-${openaiVideoId}.mp4`

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
    console.error('Download error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to download'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}