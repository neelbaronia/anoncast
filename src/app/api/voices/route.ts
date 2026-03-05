import { NextResponse } from 'next/server';
import { fetchVoices } from '@/lib/elevenlabs';
import { INWORLD_VOICES } from '@/lib/inworld';

export async function GET() {
  try {
    // Build Inworld voices (default, cheaper)
    const inworldVoices = INWORLD_VOICES.map(v => ({
      ...v,
      previewUrl: '',
      category: 'inworld',
      provider: 'inworld' as const,
    }));

    // Fetch ElevenLabs voices (premium)
    let elevenlabsVoices: Array<{ id: string; name: string; description: string; previewUrl: string; category: string; provider: string }> = [];
    try {
      const elVoices = await fetchVoices();
      elevenlabsVoices = elVoices.map(v => ({
        ...v,
        provider: 'elevenlabs' as const,
      }));
    } catch (e) {
      console.warn('Failed to fetch ElevenLabs voices:', e);
    }

    return NextResponse.json({
      success: true,
      voices: [...inworldVoices, ...elevenlabsVoices],
    });
  } catch (error) {
    console.error('Error fetching voices:', error);

    // Fallback: return at least Inworld voices
    return NextResponse.json({
      success: true,
      voices: INWORLD_VOICES.map(v => ({
        ...v,
        previewUrl: '',
        category: 'inworld',
        provider: 'inworld',
      })),
    });
  }
}
