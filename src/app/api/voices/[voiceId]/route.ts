import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Helper to search shared voices
async function findSharedVoice(voiceId: string, apiKey: string) {
  // First try searching specifically for this ID using the search parameter
  // This works for library IDs like pVnrL...
  const searchResponse = await fetch(
    `${ELEVENLABS_API_URL}/shared-voices?search=${voiceId}`, 
    {
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json',
      },
    }
  );

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    const voice = data.voices?.find((v: { voice_id: string }) => v.voice_id === voiceId);
    if (voice) return voice;
  }

  // Fallback to paginated search if search param didn't return exact match
  for (let page = 0; page < 5; page++) {
    const sharedResponse = await fetch(
      `${ELEVENLABS_API_URL}/shared-voices?page_size=100&page=${page}`, 
      {
        headers: {
          'xi-api-key': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (sharedResponse.ok) {
      const data = await sharedResponse.json();
      const voices = data.voices || [];
      
      const voice = voices.find((v: { voice_id: string }) => v.voice_id === voiceId);
      if (voice) return voice;
      
      if (voices.length < 100) break;
    } else {
      break;
    }
  }
  return null;
}

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
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    // First try with API key - your own voices
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
          inLibrary: true,
        });
      }
    }

    // Try shared voices endpoint (voice library)
    if (apiKey) {
      const voice = await findSharedVoice(voiceId, apiKey);
      if (voice) {
        return NextResponse.json({
          success: true,
          voice: {
            id: voice.voice_id,
            name: voice.name,
            description: voice.description || `${voice.gender || ''} ${voice.accent || ''} voice`.trim(),
            previewUrl: voice.preview_url || '',
            publicOwnerId: voice.public_owner_id,
          },
          inLibrary: false,
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
        { error: 'Voice not found. First add the voice to your ElevenLabs VoiceLab, then copy the voice ID from there.' },
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

// POST: Add a shared voice to user's library
export async function POST(
  request: NextRequest,
  { params }: { params: { voiceId: string } }
) {
  const { voiceId } = params;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  if (!voiceId) {
    return NextResponse.json(
      { error: 'Voice ID is required' },
      { status: 400 }
    );
  }

  try {
    // Get publicOwnerId from request body
    const body = await request.json();
    const { publicOwnerId } = body;

    if (!publicOwnerId) {
      return NextResponse.json(
        { error: 'Public owner ID is required to add voice' },
        { status: 400 }
      );
    }

    // Add the voice to user's library
    const addResponse = await fetch(
      `${ELEVENLABS_API_URL}/voices/add/${publicOwnerId}/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_name: body.name || undefined,
        }),
      }
    );

    if (!addResponse.ok) {
      const errorData = await addResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail?.message || 'Failed to add voice to library' },
        { status: addResponse.status }
      );
    }

    const result = await addResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Voice added to your library',
      voiceId: result.voice_id || voiceId,
    });
  } catch (error) {
    console.error('Error adding voice:', error);
    return NextResponse.json(
      { error: 'Failed to add voice' },
      { status: 500 }
    );
  }
}
