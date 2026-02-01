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
    // First try with API key if available
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey) {
      const authResponse = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
        headers: {
          'xi-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (authResponse.ok) {
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
    }

    // Fallback: Search in the public voices list
    const listResponse = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!listResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch voices' },
        { status: 500 }
      );
    }

    const data = await listResponse.json();
    const voice = data.voices?.find((v: { voice_id: string }) => v.voice_id === voiceId);

    if (!voice) {
      return NextResponse.json(
        { error: 'Voice not found. Make sure the voice ID is correct. Note: Private/cloned voices require an API key.' },
        { status: 404 }
      );
    }

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
