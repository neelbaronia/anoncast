import { NextResponse } from 'next/server';
import { fetchVoices } from '@/lib/elevenlabs';

export async function GET() {
  try {
    const voices = (await fetchVoices()).map(voice => ({
      ...voice,
      provider: 'elevenlabs' as const,
    }));

    return NextResponse.json({
      success: true,
      voices,
    });
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ElevenLabs voices' },
      { status: 502 }
    );
  }
}
