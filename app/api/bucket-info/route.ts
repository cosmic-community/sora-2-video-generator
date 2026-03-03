import { NextResponse } from 'next/server'

export async function GET() {
  const bucketSlug = process.env.COSMIC_BUCKET_SLUG ?? process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG ?? ''
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY

  const keyPreview = process.env.OPENAI_API_KEY
    ? `${process.env.OPENAI_API_KEY.slice(0, 7)}...${process.env.OPENAI_API_KEY.slice(-4)}`
    : 'NOT SET'

  return NextResponse.json({
    bucketSlug,
    env: {
      hasOpenAIKey,
      keyPreview,
      hasCosmicSlug: !!bucketSlug,
      hasCosmicReadKey: !!process.env.COSMIC_READ_KEY,
      hasCosmicWriteKey: !!process.env.COSMIC_WRITE_KEY,
    },
    message: hasOpenAIKey
      ? `✅ OpenAI API key is set (${keyPreview})`
      : '❌ OPENAI_API_KEY is not set — add it to your Vercel environment variables',
  })
}