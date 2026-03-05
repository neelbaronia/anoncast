import { NextResponse } from 'next/server';
import { INWORLD_VOICES } from '@/lib/inworld';

export async function GET() {
  try {
    const inworldVoices = INWORLD_VOICES.map(v => ({
      ...v,
      previewUrl: `/api/voices/preview?voice=${encodeURIComponent(v.id)}&provider=inworld`,
      category: 'inworld',
      provider: 'inworld' as const,
    }));

    return NextResponse.json({
      success: true,
      voices: inworldVoices,
    });
  } catch (error) {
    console.error('Error fetching voices:', error);

    return NextResponse.json({
      success: true,
      voices: INWORLD_VOICES.map(v => ({
        ...v,
        previewUrl: `/api/voices/preview?voice=${encodeURIComponent(v.id)}&provider=inworld`,
        category: 'inworld',
        provider: 'inworld',
      })),
    });
  }
}
