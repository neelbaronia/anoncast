import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';
import { generateSpeechInworld } from '@/lib/inworld';
import { uploadToR2Edge } from '@/lib/storage-edge';
import { supabase } from '@/lib/supabase';

function synthesize(text: string, voiceId: string, provider?: string): Promise<ArrayBuffer> {
  if (provider === 'elevenlabs') {
    return generateSpeech(text, voiceId);
  }
  // Default to Inworld
  return generateSpeechInworld(text, voiceId);
}

export const runtime = 'edge';

const BATCH_SIZE = 5;

// ~1.5 seconds of silent MP3 (128kbps, 44100Hz mono) — avoids wasting TTS credits on pauses
function generateSilence(durationMs: number = 1500): Uint8Array {
  // A minimal valid MP3 frame (MPEG1 Layer3, 128kbps, 44100Hz, mono)
  // Frame header: 0xFFFB9004, followed by zero-padding for silence
  const frameSize = 417; // bytes per frame at 128kbps/44100Hz
  const frameDurationMs = 26.12; // ms per frame
  const numFrames = Math.ceil(durationMs / frameDurationMs);
  const buf = new Uint8Array(numFrames * frameSize);
  for (let i = 0; i < numFrames; i++) {
    const off = i * frameSize;
    // MP3 frame header for MPEG1, Layer 3, 128kbps, 44100Hz, mono
    buf[off] = 0xFF;
    buf[off + 1] = 0xFB;
    buf[off + 2] = 0x90;
    buf[off + 3] = 0x04;
    // Rest of frame stays zero (silence)
  }
  return buf;
}

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

    const totalUnits = 1 + validSegments.length;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let completedUnits = 0;
          emitProgress(controller, 0, totalUnits, 'segments');

          // 1. Generate silence pause and prepare outro
          const pauseBuffer = generateSilence(1500); // 1.5s silence between paragraphs
          const outroPause = generateSilence(2000);  // 2s silence before outro
          const lastSegment = validSegments[validSegments.length - 1];
          const outroText = "This was made with anoncast. If you want to convert a blog to audio, check out anoncast dot net. Thanks for listening!";
          const outroTask = synthesize(outroText, lastSegment.voiceId, lastSegment.provider)
            .catch(() => new ArrayBuffer(0));
          completedUnits += 1;
          emitProgress(controller, completedUnits, totalUnits, 'segments');

          // 2. Process body segments in batches
          const bodyBuffers: ArrayBuffer[] = [];
          for (let i = 0; i < validSegments.length; i += BATCH_SIZE) {
            const batch = validSegments.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
              batch.map((segment: { text: string; voiceId: string; provider?: string }) => {
                const sanitizedText = `${segment.text.trim()} ...`;
                return synthesize(sanitizedText, segment.voiceId, segment.provider);
              })
            );
            bodyBuffers.push(...batchResults);
            completedUnits += batch.length;
            emitProgress(controller, completedUnits, totalUnits, 'segments');
          }

          // 3. Interleave pauses and combine
          emitProgress(controller, totalUnits, totalUnits, 'combining');
          const outroBuffer = await outroTask;
          const bodyWithPauses: (ArrayBuffer | Uint8Array)[] = [];
          bodyBuffers.forEach((buf, i) => {
            bodyWithPauses.push(buf);
            if (i < bodyBuffers.length - 1) {
              bodyWithPauses.push(pauseBuffer);
            }
          });
          const audioBuffers = [...bodyWithPauses, outroPause, outroBuffer].filter(b => b.byteLength > 0);
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
            persistWarning = `Audio upload to storage failed: ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`;
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
