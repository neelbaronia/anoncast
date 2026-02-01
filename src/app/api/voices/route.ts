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
    // Using real ElevenLabs voice IDs and preview URLs that are publicly accessible
    if (error instanceof Error && error.message.includes('ELEVENLABS_API_KEY')) {
      return NextResponse.json({
        success: true,
        voices: [
          { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, young American female', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-470d-8571-1c61dc3b4d00.mp3', category: 'premade', gender: 'female' },
          { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew', description: 'Well-rounded American male', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/29vD33N1CtxCmqQRPOHJ/b3a20183-733a-4fe5-8f1a-f8a5c23c1776.mp3', category: 'premade', gender: 'male' },
          { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde', description: 'War veteran, deep male', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/2EiwWnXFnvU5JabPnv8n/65e4a7fc-4f4e-4f64-b67f-57005bf29122.mp3', category: 'premade', gender: 'male' },
          { id: '5Q0t7uMcjvnagumLfvZi', name: 'Paul', description: 'Ground reporter, authoritative', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/5Q0t7uMcjvnagumLfvZi/4f4a6e54-05f9-4e74-b5b9-574bb7039e91.mp3', category: 'premade', gender: 'male' },
          { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, confident female', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/AZnzlk1XvdvUeBnXmlld/508e1dab-5a5f-4b37-b373-b17a97085826.mp3', category: 'premade', gender: 'female' },
          { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', description: 'British conversational male', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CYw3kZ02Hs0563khs1Fj/72d58c4f-4e1b-403c-a1b6-e7f8d9f16d2e.mp3', category: 'premade', gender: 'male' },
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
