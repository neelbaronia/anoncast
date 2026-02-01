// ElevenLabs API client

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url: string;
  category: string;
  labels: {
    accent?: string;
    description?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
}

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
  category: string;
  accent?: string;
  gender?: string;
}

function getApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }
  return apiKey;
}

export async function fetchVoices(): Promise<VoiceOption[]> {
  const apiKey = getApiKey();
  
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const voices: ElevenLabsVoice[] = data.voices;

  // Filter to get the best pre-made voices and map to our format
  // Prioritize "premade" category voices which are high-quality and free to use
  const premadeVoices = voices
    .filter(v => v.category === 'premade' || v.category === 'professional')
    .slice(0, 12) // Limit to top 12 voices
    .map(v => ({
      id: v.voice_id,
      name: v.name,
      description: v.labels.description || `${v.labels.gender || ''} ${v.labels.accent || ''} voice`.trim(),
      previewUrl: v.preview_url,
      category: v.category,
      accent: v.labels.accent,
      gender: v.labels.gender,
    }));

  return premadeVoices;
}

export async function generateSpeech(
  text: string,
  voiceId: string,
  options?: {
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
  }
): Promise<ArrayBuffer> {
  const apiKey = getApiKey();
  
  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: options?.modelId || 'eleven_monolingual_v1',
      voice_settings: {
        stability: options?.stability || 0.5,
        similarity_boost: options?.similarityBoost || 0.75,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate speech: ${response.status} - ${error}`);
  }

  return response.arrayBuffer();
}
