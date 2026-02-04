import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = params.filename;
  const r2Url = `https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/${filename}`;

  const range = request.headers.get('range');
  
  const response = await fetch(r2Url, {
    headers: range ? { range } : {},
  });

  // Extract necessary headers to pass back
  const headers = new Headers();
  const headersToPreserve = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'last-modified',
    'etag'
  ];

  headersToPreserve.forEach(header => {
    const value = response.headers.get(header);
    if (value) headers.set(header, value);
  });

  // Always ensure this is set for Apple
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
