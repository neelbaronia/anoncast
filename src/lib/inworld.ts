// Inworld TTS API client (Edge Runtime compatible)

const INWORLD_API_URL = 'https://api.inworld.ai/tts/v1/voice';
const MODEL_ID = 'inworld-tts-1.5-max';
const MAX_CHARS = 1990;

function getApiKey(): string {
  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    throw new Error('INWORLD_API_KEY environment variable is not set');
  }
  return apiKey;
}

// Base64 decode that works in Edge Runtime (no Buffer)
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function generateSpeechInworld(
  text: string,
  voiceId: string
): Promise<ArrayBuffer> {
  const apiKey = getApiKey();

  // If text exceeds limit, split at sentence boundaries and concatenate
  if (text.length > MAX_CHARS) {
    const chunks = splitTextIntoChunks(text, MAX_CHARS);
    const buffers = [];
    for (const chunk of chunks) {
      const buf = await generateSpeechInworld(chunk, voiceId);
      buffers.push(buf);
    }
    // Concatenate all buffers
    const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    return combined.buffer;
  }

  const response = await fetch(INWORLD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId: MODEL_ID,
      audioConfig: {
        audioEncoding: 'MP3',
        bitRate: 192000,
        sampleRateHertz: 48000,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Inworld TTS failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const audioContent = data.audioContent;
  if (!audioContent) {
    throw new Error('Inworld returned no audio content');
  }

  const audioBuffer = base64ToArrayBuffer(audioContent);
  if (audioBuffer.byteLength < 100) {
    throw new Error(`Inworld returned too little audio data (${audioBuffer.byteLength} bytes)`);
  }

  return audioBuffer;
}

function splitTextIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Try to split at sentence boundary
    let splitIdx = remaining.lastIndexOf('. ', maxLen);
    if (splitIdx < maxLen / 2) {
      splitIdx = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitIdx < maxLen / 2) {
      splitIdx = maxLen;
    }
    chunks.push(remaining.slice(0, splitIdx + 1).trim());
    remaining = remaining.slice(splitIdx + 1).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

// Default Inworld voices
export const INWORLD_VOICES = [
  { id: 'Clive', name: 'Clive', description: 'Male narrative voice' },
  { id: 'Luna', name: 'Luna', description: 'Female conversational voice' },
  { id: 'Max', name: 'Max', description: 'Male confident voice' },
  { id: 'Lily', name: 'Lily', description: 'Female warm voice' },
];
