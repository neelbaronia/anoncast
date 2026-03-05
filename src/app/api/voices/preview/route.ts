import { NextRequest, NextResponse } from 'next/server';
import { generateSpeechInworld } from '@/lib/inworld';

export const runtime = 'edge';

const PREVIEW_TEXT = "Here's a quick preview of what I sound like. I can narrate your blog posts and articles with natural, expressive speech.";

// Cache previews in memory to avoid regenerating
const previewCache = new Map<string, ArrayBuffer>();

export async function GET(request: NextRequest) {
  const voice = request.nextUrl.searchParams.get('voice');

  if (!voice) {
    return NextResponse.json({ error: 'Missing voice parameter' }, { status: 400 });
  }

  try {
    const cacheKey = `inworld:${voice}`;
    let audioBuffer = previewCache.get(cacheKey);

    if (!audioBuffer) {
      audioBuffer = await generateSpeechInworld(PREVIEW_TEXT, voice);
      previewCache.set(cacheKey, audioBuffer);
    }

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Preview generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
