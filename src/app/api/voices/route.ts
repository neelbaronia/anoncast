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
          { id: 'nPczCjzB2jt3Y8E44X7V', name: 'Brian', description: 'Deep, narrative, American', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/nPczCjzB2jt3Y8E44X7V/ad605336-68b6-455b-9d41-1efd75e01c90.mp3', category: 'premade', gender: 'male' },
          { id: 'XrExqIDj70D1i6ec7O3X', name: 'Matilda', description: 'Warm, narrative, American', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExqIDj70D1i6ec7O3X/264b3607-4228-403d-82c5-59b3f99056a2.mp3', category: 'premade', gender: 'female' },
          { id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas', description: 'Calm, narrative, American', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/GBv7mTt0atIp3Br8iCZE/f311c97a-e47f-4cc3-94c6-81676f1c7137.mp3', category: 'premade', gender: 'male' },
          { id: 'Lcf713o6okCna69XvIpg', name: 'Emily', description: 'Clear, narrative, American', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Lcf713o6okCna69XvIpg/2d744883-7e4a-4a8a-9214-55447195f242.mp3', category: 'premade', gender: 'female' },
          { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Relaxed, narrative, American', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3', category: 'premade', gender: 'male' },
          { id: '9BWtsm6S9Dshv8T8v8Kz', name: 'Aria', description: 'Clean, neutral, American', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/9BWtsm6S9Dshv8T8v8Kz/2d744883-7e4a-4a8a-9214-55447195f242.mp3', category: 'premade', gender: 'female' },
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
