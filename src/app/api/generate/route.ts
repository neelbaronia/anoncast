import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';
import NodeID3 from 'node-id3';

export async function POST(request: NextRequest) {
  try {
    const { segments, metadata } = await request.json();

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'No segments provided' },
        { status: 400 }
      );
    }

    // Filter for confirmed segments with a voice assigned
    const validSegments = segments.filter(s => s.voiceId && s.confirmed);

    if (validSegments.length === 0) {
      return NextResponse.json(
        { error: 'No confirmed segments with voices' },
        { status: 400 }
      );
    }

    // Generate audio for each segment
    const audioBuffers: ArrayBuffer[] = [];
    
    // 1. Generate Title Intro if provided
    if (metadata?.title && validSegments.length > 0) {
      const introVoiceId = validSegments[0].voiceId;
      try {
        const titleBuffer = await generateSpeech(metadata.title, introVoiceId);
        audioBuffers.push(titleBuffer);
        
        // Add a 1s pause (ElevenLabs adds natural padding, but we can add another short break)
        // We'll generate a "..." which typically creates a longer pause in natural speech
        const pauseBuffer = await generateSpeech("... ...", introVoiceId);
        audioBuffers.push(pauseBuffer);
      } catch (introError) {
        console.warn('Failed to generate title intro, skipping:', introError);
      }
    }

    // 2. Generate Body segments
    for (const segment of validSegments) {
      const buffer = await generateSpeech(segment.text, segment.voiceId);
      audioBuffers.push(buffer);
    }

    // Calculate total length
    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const buf of audioBuffers) {
      combinedBuffer.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    let finalBuffer: Buffer = Buffer.from(combinedBuffer);

    // Embed metadata if provided
    if (metadata) {
      const tags: NodeID3.Tags = {
        title: metadata.title,
        artist: metadata.author,
        album: 'Anoncast',
      };

      // Handle image embedding
      if (metadata.image) {
        try {
          const imageResponse = await fetch(metadata.image);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            tags.image = {
              mime: imageResponse.headers.get('content-type') || 'image/jpeg',
              type: { id: 3, name: 'front cover' },
              description: 'Cover Art',
              imageBuffer: Buffer.from(imageBuffer),
            };
          }
        } catch (imageError) {
          console.warn('Failed to fetch image for ID3 tag:', imageError);
        }
      }

      // Write tags to buffer
      const taggedBuffer = NodeID3.write(tags, finalBuffer);
      if (Buffer.isBuffer(taggedBuffer)) {
        finalBuffer = taggedBuffer;
      }
    }

    // Return the combined audio as a stream
    return new Response(finalBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': finalBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="podcast.mp3"`,
      },
    });
  } catch (error) {
    console.error('Error generating audio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status: 500 }
    );
  }
}
