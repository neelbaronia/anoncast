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

  const preferredIds = [
    'nPczCjzB2jt3Y8E44X7V', // Brian - Narrative
    'XrExqIDj70D1i6ec7O3X', // Matilda - Warm
    'TX3LPaxmHKxFdv7VOQHJ', // Liam - Relaxed Narration (Real ID)
    'XB0fDUnXUByWwe3D96u1', // Charlotte - Polite Narrative
    'iP95p4xo9A9EJ9696K7K', // Chris - Storyteller
    '9BWtsm6S9Dshv8T8v8Kz', // Aria - Clean
    'GBv7mTt0atIp3Br8iCZE', // Thomas - Calm Narrative
    'Lcf713o6okCna69XvIpg', // Emily - Clear Narrative
    'CwhRBWXzGAHq8TQ4Fs17', // Roger - Confident (Real ID)
    'cjVigLvcvMvS9S7fP5X7', // Eric - Narrative
  ];

  const excludedIds = [
    'FGY2WhTYpPnrIDTdsKH5', // Laura (ID 1)
    'FGY2WhTYp9z6o5v7v7Kz', // Laura (ID 2)
    'IKne3meq5aSn9XLyUdCD', // Charlie
    'JBFqnCBsd6RMkjVDRZzb', // George
    'Xb7hH8MSUJpSbSDYk0k2', // Alice
    'EXAVITQu4vr4xnSDxMaL', // Sarah
    'SOYHLrjzK2X1ezoPC6cr', // Harry (Real ID)
    'SOY-ID-HARRY',          // Harry (Placeholder)
    'N2lVS1w4EtoT3dr4eOWO', // Callum (Real ID)
    'N2lVS1wzCQmX96OT7sSj', // Callum (ID 2)
    'SAz9YHcvj6GT2YYXdXww', // River (Real ID)
  ];

  if (!response.ok) {
    // If API key doesn't have permission, fall back to public API
    const publicResponse = await fetch(`${ELEVENLABS_API_URL}/voices`);
    if (!publicResponse.ok) {
      throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
    }
    const publicData = await publicResponse.json();
    const publicVoices: ElevenLabsVoice[] = publicData.voices || [];
    
    return publicVoices
      .filter(v => preferredIds.includes(v.voice_id) && !excludedIds.includes(v.voice_id))
      .sort((a, b) => preferredIds.indexOf(a.voice_id) - preferredIds.indexOf(b.voice_id))
      .slice(0, 6)
      .map(v => ({
        id: v.voice_id,
        name: v.name,
        description: v.labels?.description || `${v.labels?.gender || ''} ${v.labels?.accent || ''} voice`.trim(),
        previewUrl: v.preview_url,
        category: v.category,
        accent: v.labels?.accent,
        gender: v.labels?.gender,
      }));
  }

  const data = await response.json();
  const voices: ElevenLabsVoice[] = data.voices;

  // 1. First try to get our preferred voices that are actually available in the account
  let selectedVoices = voices
    .filter(v => preferredIds.includes(v.voice_id) && !excludedIds.includes(v.voice_id))
    .sort((a, b) => preferredIds.indexOf(a.voice_id) - preferredIds.indexOf(b.voice_id));

  // 2. If we have fewer than 6, add other high-quality premade voices that aren't excluded
  if (selectedVoices.length < 6) {
    const otherPremade = voices
      .filter(v => 
        v.category === 'premade' && 
        !preferredIds.includes(v.voice_id) && 
        !excludedIds.includes(v.voice_id)
      )
      .slice(0, 6 - selectedVoices.length);
    selectedVoices = [...selectedVoices, ...otherPremade];
  }

  // 3. Map to our format and ensure we only have 6
  return selectedVoices.slice(0, 6).map(v => ({
    id: v.voice_id,
    name: v.name,
    description: v.labels?.description || `${v.labels?.gender || ''} ${v.labels?.accent || ''} voice`.trim(),
    previewUrl: v.preview_url,
    category: v.category,
    accent: v.labels?.accent,
    gender: v.labels?.gender,
  }));
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
      model_id: options?.modelId || 'eleven_v3',
      voice_settings: {
        stability: options?.stability || 1.0,
        similarity_boost: options?.similarityBoost || 0.75,
        style: 0,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate speech: ${response.status} - ${error}`);
  }

  return response.arrayBuffer();
}
