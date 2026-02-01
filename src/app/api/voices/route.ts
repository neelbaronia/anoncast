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
    if (error instanceof Error && error.message.includes('ELEVENLABS_API_KEY')) {
      return NextResponse.json({
        success: true,
        voices: [
          { id: 'mock-1', name: 'Rachel', description: 'Warm, conversational American', previewUrl: '', category: 'premade', gender: 'female' },
          { id: 'mock-2', name: 'Drew', description: 'Well-rounded American', previewUrl: '', category: 'premade', gender: 'male' },
          { id: 'mock-3', name: 'Clyde', description: 'War veteran, deep voice', previewUrl: '', category: 'premade', gender: 'male' },
          { id: 'mock-4', name: 'Paul', description: 'Ground reporter, authoritative', previewUrl: '', category: 'premade', gender: 'male' },
          { id: 'mock-5', name: 'Domi', description: 'Strong, confident female', previewUrl: '', category: 'premade', gender: 'female' },
          { id: 'mock-6', name: 'Dave', description: 'British conversational', previewUrl: '', category: 'premade', gender: 'male' },
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
