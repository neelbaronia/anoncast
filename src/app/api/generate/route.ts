import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';
import NodeID3 from 'node-id3';
import { uploadToR2 } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

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
        artist: 'anoncast.net',
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

    // 3. Persist to Storage and Database
    let audioUrl = '';
    const GLOBAL_SHOW_ID = '00000000-0000-0000-0000-000000000000';

    try {
      const fileName = `${uuidv4()}.mp3`;
      audioUrl = await uploadToR2(finalBuffer, fileName);

      // Add episode to the global show
      const { error: episodeError } = await supabase
        .from('episodes')
        .insert({
          show_id: GLOBAL_SHOW_ID,
          title: metadata?.title || 'Untitled Episode',
          description: `${metadata?.firstSentence || ''}\n\nOriginal blog: ${metadata?.url || 'Unknown source'}\n\nConvert your blog to audio at https://www.anoncast.net/ , or browse generated episodes at https://www.anoncast.net/generated`,
          audio_url: audioUrl,
          image_url: (metadata?.image || null)?.replace('.png', '.jpg'), // Ensure .jpg for fallback image
          duration: Math.round(finalBuffer.length / 16000), // Very rough estimate
          file_size: finalBuffer.length // Exact byte size for RSS enclosure
        });

      if (episodeError) throw episodeError;
    } catch (persistError) {
      console.error('Failed to persist to R2/Supabase:', persistError);
    }

    // Return audio with the global show ID
    return new Response(new Uint8Array(finalBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': finalBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="podcast.mp3"`,
        'X-Audio-URL': audioUrl,
        'X-Show-Id': GLOBAL_SHOW_ID,
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
