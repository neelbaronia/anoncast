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
    console.log(`Starting generation for ${validSegments.length} segments...`);
    
    // 1. Prepare Title Intro tasks if provided
    let introTasks: Promise<ArrayBuffer>[] = [];
    if (metadata?.title && validSegments.length > 0) {
      const introVoiceId = validSegments[0].voiceId;
      console.log('Generating title intro...');
      introTasks = [
        generateSpeech(metadata.title, introVoiceId),
        generateSpeech(" . . . . . ", introVoiceId) // 1s pause
      ];
    }

    // 2. Prepare Body tasks data (we'll execute them in batches below)
    console.log('Preparing body segment data...');
    // We don't map to promises here yet, we do it in the batch loop
    
    // 3. Prepare Outro tasks
    let outroTasks: Promise<ArrayBuffer>[] = [];
    if (validSegments.length > 0) {
      const outroVoiceId = validSegments[validSegments.length - 1].voiceId;
      console.log('Preparing outro tasks...');
      const outroText = "This was made with anoncast. If you want to convert a blog to audio, check out anoncast dot net. Thanks for listening!";
      outroTasks = [
        generateSpeech(" . . . . . ", outroVoiceId), // 1s pause
        generateSpeech(outroText, outroVoiceId)
      ];
    }

    // 4. Prepare Pause task
    const pauseTask = generateSpeech(" . . ", validSegments[0].voiceId); // ~0.5s pause to reuse

    // Execute tasks with concurrency control to avoid ElevenLabs 429 errors
    console.log('Executing ElevenLabs requests in controlled batches...');
    const startTime = Date.now();
    
    // 1. Run intro, outro, and pause in parallel (small number of requests)
    const [introBuffers, pauseBuffer, outroBuffers] = await Promise.all([
      Promise.all(introTasks.map(p => p.catch(e => {
        console.warn('Intro task failed:', e);
        return new ArrayBuffer(0);
      }))),
      pauseTask.catch(e => {
        console.warn('Pause buffer failed:', e);
        return new ArrayBuffer(0);
      }),
      Promise.all(outroTasks.map(p => p.catch(e => {
        console.warn('Outro task failed:', e);
        return new ArrayBuffer(0);
      })))
    ]);

    // 2. Process body segments in batches to stay under the 10-concurrent-request limit
    const bodyBuffers: ArrayBuffer[] = [];
    const BATCH_SIZE = 5; // Safely below the 10 limit
    
    for (let i = 0; i < validSegments.length; i += BATCH_SIZE) {
      const batch = validSegments.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(validSegments.length/BATCH_SIZE)}...`);
      
      const batchResults = await Promise.all(
        batch.map(segment => generateSpeech(segment.text, segment.voiceId))
      );
      
      bodyBuffers.push(...batchResults);
    }

    // Interleave pause buffers between body segments
    const bodyWithPauses: ArrayBuffer[] = [];
    bodyBuffers.forEach((buf, i) => {
      bodyWithPauses.push(buf);
      // Add pause between segments (not after the last one)
      if (i < bodyBuffers.length - 1 && pauseBuffer.byteLength > 0) {
        bodyWithPauses.push(pauseBuffer);
      }
    });

    const audioBuffers = [...introBuffers, ...bodyWithPauses, ...outroBuffers].filter(b => b.byteLength > 0);
    
    console.log(`All segments generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

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
        artist: metadata.author || 'anoncast.net',
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
          description: `Original blog: ${metadata?.url || 'Unknown source'}\n\n${metadata?.firstSentence || ''}\n\nConvert your blog to audio at https://www.anoncast.net/ , or browse generated episodes at https://www.anoncast.net/generated`,
          audio_url: audioUrl,
          image_url: metadata?.image || null, // Keep original image URL (PNG or JPG)
          duration: Math.round(finalBuffer.length / 16000), // Very rough estimate
          file_size: finalBuffer.length, // Exact byte size for RSS enclosure
          source_url: metadata?.url || null // Save source URL for redundancy checks
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
