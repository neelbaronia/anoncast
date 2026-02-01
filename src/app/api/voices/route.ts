import { NextResponse } from 'next/server';
import { fetchVoices } from '@/lib/elevenlabs';

export async function GET() {
  try {
    const voices = await fetchVoices();

    return NextResponse.json({
      success: true,
      voices,
    });
  } catch (error) {
    console.error('Error fetching voices:', error);
    
    // Return mock voices if API key not set (for development)
    // Using real ElevenLabs voice IDs and preview URLs from their public API
    if (error instanceof Error && error.message.includes('ELEVENLABS_API_KEY')) {
      return NextResponse.json({
        success: true,
        voices: [
          { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Laid-back, casual, resonant', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3', category: 'premade', gender: 'male' },
          { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Mature, reassuring, confident', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3', category: 'premade', gender: 'female' },
          { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Enthusiastic, quirky attitude', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3', category: 'premade', gender: 'female' },
          { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Deep, confident, energetic', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3', category: 'premade', gender: 'male' },
          { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Warm, captivating storyteller', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3', category: 'premade', gender: 'male' },
          { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Husky trickster', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3', category: 'premade', gender: 'male' },
        ],
        mock: true,
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch voices' },
      { status: 500 }
    );
  }
}
