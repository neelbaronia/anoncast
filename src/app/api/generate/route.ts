import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech, resolveElevenLabsVoiceId } from '@/lib/elevenlabs';
import { assembleMp3Chunks } from '@/lib/audio/mp3';
import { finalAudioPersistenceFields } from '@/lib/audio/persistence';
import { uploadToR2 } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { coalesceTtsSegments } from '@/lib/tts-segments';

function synthesize(text: string, voiceId: string, provider?: string): Promise<ArrayBuffer> {
  const resolvedVoiceId = provider === 'elevenlabs'
    ? voiceId
    : resolveElevenLabsVoiceId(voiceId);
  return generateSpeech(text, resolvedVoiceId);
}

export const runtime = 'nodejs';
export const maxDuration = 300;

// The current ElevenLabs subscription permits two concurrent requests.
// Keep each batch at that ceiling and synthesize the outro separately.
const BATCH_SIZE = 2;


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
    const { segments, metadata, pendingGenerationId } = await request.json();

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'No segments provided' },
        { status: 400 }
      );
    }

    const validSegments = coalesceTtsSegments(segments);

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

          // 1. Prepare outro metadata. Synthesis happens after the body so it
          // does not consume a third ElevenLabs concurrency slot.
          const lastSegment = validSegments[validSegments.length - 1];
          const outroText = "...... This was made with anoncast. If you want to convert a blog to audio, check out anoncast dot net. Thanks for listening!";

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

          // 3. Generate the outro after the body batches. Each ElevenLabs
          // response is an independently encoded MP3, so decode and normalize
          // every chunk before performing one final MP3 encode.
          const outroBuffer = await synthesize(outroText, lastSegment.voiceId, lastSegment.provider)
            .catch(() => new ArrayBuffer(0));
          completedUnits += 1;
          emitProgress(controller, completedUnits, totalUnits, 'segments');

          emitProgress(controller, totalUnits, totalUnits, 'combining');
          const audioBuffers = [...bodyBuffers, outroBuffer].filter(b => b.byteLength > 0);
          const finalAudio = await assembleMp3Chunks(audioBuffers);

          // 4. Upload only after the final artifact has been encoded, probed,
          // and fully decoded once without structural MP3 warnings.
          emitProgress(controller, totalUnits, totalUnits, 'uploading');
          const fileName = `${crypto.randomUUID()}.mp3`;
          const audioUrl = await uploadToR2(finalAudio.buffer, fileName);
          let r2ImageUrl = metadata?.image || null;
          const GLOBAL_SHOW_ID = '00000000-0000-0000-0000-000000000000';

          // Upload image to R2. An image failure does not affect the already
          // validated audio and the original image URL remains as the fallback.
          if (metadata?.image) {
            try {
              const imageResponse = await fetch(metadata.image);
              if (imageResponse.ok) {
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                const imageExt = contentType.split('/')[1] || 'jpg';
                const imageFileName = `${crypto.randomUUID()}.${imageExt}`;
                r2ImageUrl = await uploadToR2(imageBuffer, imageFileName, contentType);
              }
            } catch (imageError) {
              console.warn('Image upload failed; retaining original URL:', imageError);
            }
          }

          // The database row is the publication boundary: RSS cannot expose an
          // episode until the validated asset upload and this insert succeed.
          const { error: dbError } = await supabase.from('episodes').insert({
            show_id: GLOBAL_SHOW_ID,
            title: metadata?.title || 'Untitled Episode',
            description: `Original blog: ${metadata?.url || 'Unknown source'}\n\n${metadata?.firstSentence || ''}\n\nConvert your blog to audio at https://www.anoncast.net/ , or browse generated episodes at https://www.anoncast.net/generated`,
            audio_url: audioUrl,
            image_url: r2ImageUrl,
            ...finalAudioPersistenceFields(finalAudio),
            source_url: metadata?.url || null,
            voice_id: validSegments[0]?.voiceId || null
          });
          if (dbError) {
            throw new Error(`Episode database insert failed after audio upload: ${dbError.message}`);
          }

          // A paid generation remains retryable until its validated episode has
          // crossed the publication boundary above.
          if (typeof pendingGenerationId === 'string' && pendingGenerationId) {
            const { error: consumeError } = await supabase
              .from('pending_generations')
              .update({ consumed: true })
              .eq('id', pendingGenerationId)
              .eq('consumed', false);
            if (consumeError) {
              console.error('Pending generation completion update failed:', consumeError);
            }
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
