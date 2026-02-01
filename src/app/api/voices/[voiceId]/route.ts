import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: { voiceId: string } }
) {
  const { voiceId } = params;

  if (!voiceId) {
    return NextResponse.json(
      { error: 'Voice ID is required' },
      { status: 400 }
    );
  }

  try {
    // Try to fetch from ElevenLabs public API (no auth needed for public voices)
    const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // If not found publicly, try with API key if available
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (apiKey) {
        const authResponse = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
          headers: {
            'xi-api-key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (!authResponse.ok) {
          return NextResponse.json(
            { error: 'Voice not found' },
            { status: 404 }
          );
        }

        const voice = await authResponse.json();
        return NextResponse.json({
          success: true,
          voice: {
            id: voice.voice_id,
            name: voice.name,
            description: voice.labels?.description || `${voice.labels?.gender || ''} ${voice.labels?.accent || ''} voice`.trim(),
            previewUrl: voice.preview_url || '',
          },
        });
      }

      return NextResponse.json(
        { error: 'Voice not found. Make sure the voice ID is correct and the voice is publicly shared.' },
        { status: 404 }
      );
    }

    const voice = await response.json();

    return NextResponse.json({
      success: true,
      voice: {
        id: voice.voice_id,
        name: voice.name,
        description: voice.labels?.description || `${voice.labels?.gender || ''} ${voice.labels?.accent || ''} voice`.trim(),
        previewUrl: voice.preview_url || '',
      },
    });
  } catch (error) {
    console.error('Error fetching voice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voice' },
      { status: 500 }
    );
  }
}
