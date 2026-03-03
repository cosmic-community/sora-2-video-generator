import { NextRequest, NextResponse } from 'next/server'
import { startVideoGeneration } from '@/lib/openai'
import { createVideoRecord } from '@/lib/cosmic'
import type { GenerateVideoRequest } from '@/types'

const VALID_SECONDS = ['4', '8', '12']
const VALID_MODELS = ['sora-2', 'sora-2-pro']
const VALID_SIZES = ['1280x720', '1920x1080', '480x480']

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateVideoRequest
    const { prompt, model, size, seconds } = body

    console.log('[Generate] Request:', {
      prompt: prompt ? prompt.slice(0, 60) + '...' : '(empty)',
      model,
      size,
      seconds,
    })

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }
    if (prompt.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Prompt must be under 2000 characters' },
        { status: 400 }
      )
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'OPENAI_API_KEY is not configured. Add it to your environment variables.',
        },
        { status: 500 }
      )
    }

    const resolvedModel = model ?? 'sora-2'
    const resolvedSize = size ?? '1280x720'
    const resolvedSeconds = seconds ?? '4'

    if (!VALID_SECONDS.includes(resolvedSeconds)) {
      return NextResponse.json(
        {
          error: `Invalid seconds "${resolvedSeconds}". Use: ${VALID_SECONDS.join(', ')}`,
        },
        { status: 400 }
      )
    }
    if (!VALID_MODELS.includes(resolvedModel)) {
      return NextResponse.json(
        {
          error: `Invalid model "${resolvedModel}". Use: ${VALID_MODELS.join(', ')}`,
        },
        { status: 400 }
      )
    }
    if (!VALID_SIZES.includes(resolvedSize)) {
      return NextResponse.json(
        {
          error: `Invalid size "${resolvedSize}". Use: ${VALID_SIZES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Changed: Call the Videos API via SDK — model, prompt, size, seconds all sent correctly
    const openaiVideo = await startVideoGeneration(
      prompt.trim(),
      resolvedModel,
      resolvedSize,
      resolvedSeconds
    )

    // Changed: Save to Cosmic CMS with the OpenAI video ID
    const cosmicVideo = await createVideoRecord(
      prompt.trim(),
      openaiVideo.id,
      resolvedModel,
      resolvedSize,
      resolvedSeconds
    )

    console.log(
      '[Generate] Cosmic record:',
      cosmicVideo.id,
      'OpenAI:',
      openaiVideo.id
    )

    return NextResponse.json({
      data: {
        cosmicId: cosmicVideo.id,
        openaiVideoId: openaiVideo.id,
        status: openaiVideo.status,
        progress: openaiVideo.progress,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to start generation'
    console.error('[Generate] Error:', message)
    if (error instanceof Error && error.stack)
      console.error('[Generate] Stack:', error.stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}