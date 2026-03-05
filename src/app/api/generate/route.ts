import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';
import { uploadToR2Edge } from '@/lib/storage-edge';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

const BATCH_SIZE = 5;

function emitProgress(controller: ReadableStreamDefaultController, done: number, total: number, phase: 'segments' | 'combining' | 'uploading') {
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

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'No segments provided' },
        { status: 400 }
      );
    }

    const validSegments = segments.filter((s: { voiceId?: string; confirmed?: boolean }) => s.voiceId && s.confirmed);

    if (validSegments.length === 0) {
      return NextResponse.json(
        { error: 'No confirmed segments with voices' },
        { status: 400 }
      );
    }

    const totalUnits = 3 + validSegments.length;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let completedUnits = 0;
          emitProgress(controller, 0, totalUnits, 'segments');

          // 1. Prepare outro and pause
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
              batch.map((segment: { text: string; voiceId: string }) => {
                const sanitizedText = `${segment.text.trim()} ...`;
                return generateSpeech(sanitizedText, segment.voiceId);
              })
            );
            bodyBuffers.push(...batchResults);
            completedUnits += batch.length;
            emitProgress(controller, completedUnits, totalUnits, 'segments');
          }

          // 3. Interleave pauses and combine
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

          // 4. Upload to R2
          emitProgress(controller, totalUnits, totalUnits, 'uploading');
          let audioUrl = '';
          let r2ImageUrl = metadata?.image || null;
          const GLOBAL_SHOW_ID = '00000000-0000-0000-0000-000000000000';

          let persistWarning = '';
          try {
            const fileName = `${crypto.randomUUID()}.mp3`;
            audioUrl = await uploadToR2Edge(combinedBuffer, fileName);
          } catch (r2Error) {
            console.error('R2 upload failed:', r2Error);
            persistWarning = 'Audio upload to storage failed.';
          }

          if (audioUrl) {
            // Upload image to R2
            if (metadata?.image) {
              try {
                const imageResponse = await fetch(metadata.image);
                if (imageResponse.ok) {
                  const imageBuffer = await imageResponse.arrayBuffer();
                  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                  const imageExt = contentType.split('/')[1] || 'jpg';
                  const imageFileName = `${crypto.randomUUID()}.${imageExt}`;
                  r2ImageUrl = await uploadToR2Edge(new Uint8Array(imageBuffer), imageFileName, contentType);
                }
              } catch {}
            }

            // Save to Supabase
            try {
              const { error: dbError } = await supabase.from('episodes').insert({
                show_id: GLOBAL_SHOW_ID,
                title: metadata?.title || 'Untitled Episode',
                description: `Original blog: ${metadata?.url || 'Unknown source'}\n\n${metadata?.firstSentence || ''}\n\nConvert your blog to audio at https://www.anoncast.net/ , or browse generated episodes at https://www.anoncast.net/generated`,
                audio_url: audioUrl,
                image_url: r2ImageUrl,
                duration: Math.round(combinedBuffer.byteLength / 16000),
                file_size: combinedBuffer.byteLength,
                source_url: metadata?.url || null,
                voice_id: validSegments[0]?.voiceId || null
              });
              if (dbError) {
                console.error('Supabase insert failed:', dbError);
                persistWarning = `Episode saved to storage but database record failed: ${dbError.message}`;
              }
            } catch (dbError) {
              console.error('Supabase insert exception:', dbError);
              persistWarning = 'Episode saved to storage but database record failed.';
            }
          }

          if (persistWarning) {
            const warningLine = JSON.stringify({ type: 'warning', message: persistWarning }) + '\n';
            controller.enqueue(new TextEncoder().encode(warningLine));
          }

          const completeLine = JSON.stringify({
            type: 'complete',
            showId: GLOBAL_SHOW_ID,
            audioUrl,
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
  } catch (error) {
    console.error('Error generating audio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status: 500 }
    );
  }
}
