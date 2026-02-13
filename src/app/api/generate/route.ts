import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';
import NodeID3 from 'node-id3';
import { uploadToR2 } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const BATCH_SIZE = 5; // Safely below the 10 limit

function emitProgress(controller: ReadableStreamDefaultController, done: number, total: number, phase: 'segments' | 'combining' | 'uploading') {
  // 0-80% for segments, 80-95% for combining, 95-100% for upload
  let percent: number;
  if (phase === 'segments') {
    percent = total > 0 ? Math.round((done / total) * 80) : 0;
  } else if (phase === 'combining') {
    percent = 85;
  } else {
    percent = 95;
  }
  const line = JSON.stringify({ type: 'progress', done, total, percent, phase }) + '\n';
  controller.enqueue(new TextEncoder().encode(line));
}

export async function POST(request: NextRequest) {
  try {
    const { segments, metadata } = await request.json();
    const streamProgress = request.headers.get('X-Stream-Progress') === 'true';

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

    // Total work units: 1 (pause) + 2 (outro) + N (body segments)
    const totalUnits = 3 + validSegments.length;

    if (streamProgress) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let completedUnits = 0;
            emitProgress(controller, 0, totalUnits, 'segments');

            // 1. Prepare Outro tasks
            let outroTasks: Promise<ArrayBuffer>[] = [];
            if (validSegments.length > 0) {
              const outroVoiceId = validSegments[validSegments.length - 1].voiceId;
              const outroText = "This was made with anoncast. If you want to convert a blog to audio, check out anoncast dot net. Thanks for listening! ...";
              outroTasks = [
                generateSpeech(" . . . . . ", outroVoiceId),
                generateSpeech(outroText, outroVoiceId)
              ];
            }
            const pauseTask = generateSpeech(" . . . . . ", validSegments[0].voiceId);

            // 1. Run outro and pause in parallel
            const [pauseBuffer, outroBuffers] = await Promise.all([
              pauseTask.catch(() => new ArrayBuffer(0)),
              Promise.all(outroTasks.map(p => p.catch(() => new ArrayBuffer(0))))
            ]);
            completedUnits += 3;
            emitProgress(controller, completedUnits, totalUnits, 'segments');

            // 2. Process body segments in batches
            const bodyBuffers: ArrayBuffer[] = [];
            for (let i = 0; i < validSegments.length; i += BATCH_SIZE) {
              const batch = validSegments.slice(i, i + BATCH_SIZE);
              const batchResults = await Promise.all(
                batch.map(segment => {
                  const sanitizedText = `${segment.text.trim()} ...`;
                  return generateSpeech(sanitizedText, segment.voiceId);
                })
              );
              bodyBuffers.push(...batchResults);
              completedUnits += batch.length;
              emitProgress(controller, completedUnits, totalUnits, 'segments');
            }

            // Interleave pauses and combine
            emitProgress(controller, totalUnits, totalUnits, 'combining');
            const bodyWithPauses: ArrayBuffer[] = [];
            bodyBuffers.forEach((buf, i) => {
              bodyWithPauses.push(buf);
              if (i < bodyBuffers.length - 1 && pauseBuffer.byteLength > 0) {
                bodyWithPauses.push(pauseBuffer);
              }
            });
            const audioBuffers = [...bodyWithPauses, ...outroBuffers].filter(b => b.byteLength > 0);
            const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.byteLength, 0);
            const combinedBuffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const buf of audioBuffers) {
              combinedBuffer.set(new Uint8Array(buf), offset);
              offset += buf.byteLength;
            }
            let finalBuffer: Buffer = Buffer.from(combinedBuffer);

            // Embed metadata
            if (metadata) {
              const tags: NodeID3.Tags = {
                title: metadata.title,
                artist: metadata.author || 'anoncast.net',
                album: 'Anoncast',
              };
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
                } catch {}
              }
              const taggedBuffer = NodeID3.write(tags, finalBuffer);
              if (Buffer.isBuffer(taggedBuffer)) finalBuffer = taggedBuffer;
            }

            emitProgress(controller, totalUnits, totalUnits, 'uploading');
            let audioUrl = '';
            let r2ImageUrl = metadata?.image || null;
            const GLOBAL_SHOW_ID = '00000000-0000-0000-0000-000000000000';

            try {
              const fileName = `${uuidv4()}.mp3`;
              audioUrl = await uploadToR2(finalBuffer, fileName);
              if (metadata?.image) {
                try {
                  const imageResponse = await fetch(metadata.image);
                  if (imageResponse.ok) {
                    const imageBuffer = await imageResponse.arrayBuffer();
                    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                    const imageExt = contentType.split('/')[1] || 'jpg';
                    const imageFileName = `${uuidv4()}.${imageExt}`;
                    r2ImageUrl = await uploadToR2(Buffer.from(imageBuffer), imageFileName, contentType);
                  }
                } catch {}
              }
              await supabase.from('episodes').insert({
                show_id: GLOBAL_SHOW_ID,
                title: metadata?.title || 'Untitled Episode',
                description: `Original blog: ${metadata?.url || 'Unknown source'}\n\n${metadata?.firstSentence || ''}\n\nConvert your blog to audio at https://www.anoncast.net/ , or browse generated episodes at https://www.anoncast.net/generated`,
                audio_url: audioUrl,
                image_url: r2ImageUrl,
                duration: Math.round(finalBuffer.length / 16000),
                file_size: finalBuffer.length,
                source_url: metadata?.url || null,
                voice_id: validSegments[0]?.voiceId || null
              });
            } catch (persistError) {
              console.error('Failed to persist:', persistError);
            }

            const base64 = Buffer.from(finalBuffer).toString('base64');
            const completeLine = JSON.stringify({
              type: 'complete',
              showId: GLOBAL_SHOW_ID,
              audioUrl,
              base64,
            }) + '\n';
            controller.enqueue(new TextEncoder().encode(completeLine));
            controller.close();
          } catch (err) {
            console.error('Stream error:', err);
            const errLine = JSON.stringify({
              type: 'error',
              error: err instanceof Error ? err.message : 'Generation failed',
            }) + '\n';
            controller.enqueue(new TextEncoder().encode(errLine));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming path (original behavior)
    console.log(`Starting generation for ${validSegments.length} segments...`);
    let outroTasks: Promise<ArrayBuffer>[] = [];
    if (validSegments.length > 0) {
      const outroVoiceId = validSegments[validSegments.length - 1].voiceId;
      const outroText = "This was made with anoncast. If you want to convert a blog to audio, check out anoncast dot net. Thanks for listening! ...";
      outroTasks = [
        generateSpeech(" . . . . . ", outroVoiceId),
        generateSpeech(outroText, outroVoiceId)
      ];
    }
    const pauseTask = generateSpeech(" . . . . . ", validSegments[0].voiceId);

    const startTime = Date.now();
    const [pauseBuffer, outroBuffers] = await Promise.all([
      pauseTask.catch(e => {
        console.warn('Pause buffer failed:', e);
        return new ArrayBuffer(0);
      }),
      Promise.all(outroTasks.map(p => p.catch(e => {
        console.warn('Outro task failed:', e);
        return new ArrayBuffer(0);
      })))
    ]);

    const bodyBuffers: ArrayBuffer[] = [];
    for (let i = 0; i < validSegments.length; i += BATCH_SIZE) {
      const batch = validSegments.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(validSegments.length/BATCH_SIZE)}...`);
      const batchResults = await Promise.all(
        batch.map(segment => {
          const sanitizedText = `${segment.text.trim()} ...`;
          return generateSpeech(sanitizedText, segment.voiceId);
        })
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

    const audioBuffers = [...bodyWithPauses, ...outroBuffers].filter(b => b.byteLength > 0);
    
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
    let r2ImageUrl = metadata?.image || null;
    const GLOBAL_SHOW_ID = '00000000-0000-0000-0000-000000000000';

    try {
      const fileName = `${uuidv4()}.mp3`;
      audioUrl = await uploadToR2(finalBuffer, fileName);

      // Also upload image to R2 if it exists to ensure reliability for Apple Podcasts
      if (metadata?.image) {
        try {
          const imageResponse = await fetch(metadata.image);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            const imageExt = contentType.split('/')[1] || 'jpg';
            const imageFileName = `${uuidv4()}.${imageExt}`;
            r2ImageUrl = await uploadToR2(Buffer.from(imageBuffer), imageFileName, contentType);
            console.log('Uploaded episode image to R2:', r2ImageUrl);
          }
        } catch (imageUploadError) {
          console.warn('Failed to upload image to R2, falling back to original URL:', imageUploadError);
        }
      }

      // Add episode to the global show
      const { error: episodeError } = await supabase
        .from('episodes')
        .insert({
          show_id: GLOBAL_SHOW_ID,
          title: metadata?.title || 'Untitled Episode',
          description: `Original blog: ${metadata?.url || 'Unknown source'}\n\n${metadata?.firstSentence || ''}\n\nConvert your blog to audio at https://www.anoncast.net/ , or browse generated episodes at https://www.anoncast.net/generated`,
          audio_url: audioUrl,
          image_url: r2ImageUrl, // Use the R2 image URL for better reliability
          duration: Math.round(finalBuffer.length / 16000), // Very rough estimate
          file_size: finalBuffer.length, // Exact byte size for RSS enclosure
          source_url: metadata?.url || null, // Save source URL for redundancy checks
          voice_id: validSegments[0]?.voiceId || null // Save the primary narrator's voice ID
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
