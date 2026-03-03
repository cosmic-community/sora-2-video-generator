import { NextRequest, NextResponse } from 'next/server'
import { getVideoStatus } from '@/lib/openai'
import { updateVideoRecord } from '@/lib/cosmic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const openaiVideoId = searchParams.get('openaiVideoId')
  const cosmicId = searchParams.get('cosmicId')

  if (!openaiVideoId || !cosmicId) {
    return NextResponse.json(
      { error: 'openaiVideoId and cosmicId are required' },
      { status: 400 }
    )
  }

  try {
    const status = await getVideoStatus(openaiVideoId)

    // Update Cosmic record with latest status
    const updates: Record<string, string | number> = {
      status: status.status,
      progress: status.progress,
    }
    if (status.error) {
      updates.error_message = status.error
    }
    await updateVideoRecord(cosmicId, updates)

    return NextResponse.json({ data: status })
  } catch (error) {
    console.error('Status error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to get status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}