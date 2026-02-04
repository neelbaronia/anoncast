import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = params.filename;
  const r2Url = `https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/${filename}`;

  // Forward the request to R2, including any Range headers from Apple
  const response = await fetch(r2Url, {
    headers: {
      range: request.headers.get('range') || '',
    },
  });

  // Create a new response with the audio data and the correct headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  // Ensure these specific headers are present for Apple
  newResponse.headers.set('Accept-Ranges', 'bytes');
  newResponse.headers.set('Access-Control-Allow-Origin', '*');

  return newResponse;
}
