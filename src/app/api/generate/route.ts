import { NextRequest, NextResponse } from 'next/server';

import {
  audioGenerationStateFromMetadata,
  createAudioGenerationState,
  generationChunkKey,
  generationOutroKey,
  metadataWithAudioGenerationState,
  metadataWithoutAudioGenerationState,
  parseAudioGenerationState,
  type AudioGenerationState,
} from '@/lib/audio/generation-state';
import { assembleMp3Chunks } from '@/lib/audio/mp3';
import { finalAudioPersistenceFields } from '@/lib/audio/persistence';
import { generateSpeech, resolveElevenLabsVoiceId } from '@/lib/elevenlabs';
import {
  deleteR2Objects,
  getR2PublicUrl,
  uploadToR2,
} from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { coalesceTtsSegments, type TtsSegment } from '@/lib/tts-segments';

function synthesize(text: string, voiceId: string, provider?: string): Promise<ArrayBuffer> {
  const resolvedVoiceId = provider === 'elevenlabs'
    ? voiceId
    : resolveElevenLabsVoiceId(voiceId);
  return generateSpeech(text, resolvedVoiceId);
}

export const runtime = 'nodejs';
export const maxDuration = 300;

// The current ElevenLabs subscription permits two concurrent requests. Long
// articles resume across HTTP invocations so every invocation stays below the
// Vercel Hobby duration ceiling.
const BATCH_SIZE = 2;
const GLOBAL_SHOW_ID = '00000000-0000-0000-0000-000000000000';

type GenerationPhase = 'segments' | 'combining' | 'uploading';

function emit(
  controller: ReadableStreamDefaultController,
  event: Record<string, unknown>,
): void {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
}

function emitProgress(
  controller: ReadableStreamDefaultController,
  done: number,
  total: number,
  phase: GenerationPhase,
): void {
  let percent: number;
  if (phase === 'segments') {
    percent = total > 0 ? Math.round((done / total) * 80) : 0;
  } else if (phase === 'combining') {
    percent = 85;
  } else {
    percent = 95;
  }
  emit(controller, { type: 'progress', done, total, percent, phase });
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value ? value : null;
}

async function persistPendingState(
  pendingGenerationId: string | undefined,
  metadata: Record<string, unknown>,
  state: AudioGenerationState,
): Promise<void> {
  if (!pendingGenerationId) return;

  const { data, error } = await supabase
    .from('pending_generations')
    .update({ metadata: metadataWithAudioGenerationState(metadata, state) })
    .eq('id', pendingGenerationId)
    .eq('consumed', false)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `Unable to persist generation progress: ${error?.message || 'paid generation is unavailable'}`,
    );
  }
}

async function downloadIntermediateChunk(key: string): Promise<ArrayBuffer> {
  const response = await fetch(getR2PublicUrl(key), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load generated audio chunk: HTTP ${response.status}`);
  }
  return response.arrayBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pendingGenerationId = typeof body.pendingGenerationId === 'string'
      ? body.pendingGenerationId
      : undefined;

    let sourceSegments = body.segments;
    let storedMetadata: unknown = body.metadata;

    // Paid retries always use the server-side source and progress state. A
    // caller cannot replace paid article text or inject arbitrary chunk URLs.
    if (pendingGenerationId) {
      const { data: pending, error: pendingError } = await supabase
        .from('pending_generations')
        .select('segments,metadata')
        .eq('id', pendingGenerationId)
        .eq('consumed', false)
        .single();

      if (pendingError || !pending) {
        return NextResponse.json(
          { error: 'Paid generation is unavailable or already completed' },
          { status: 409 },
        );
      }
      sourceSegments = pending.segments;
      storedMetadata = pending.metadata;
    }

    if (!sourceSegments || !Array.isArray(sourceSegments) || sourceSegments.length === 0) {
      return NextResponse.json({ error: 'No segments provided' }, { status: 400 });
    }

    const validSegments = coalesceTtsSegments(sourceSegments as TtsSegment[]);
    if (validSegments.length === 0) {
      return NextResponse.json(
        { error: 'No confirmed segments with voices' },
        { status: 400 },
      );
    }

    const metadata = metadataWithoutAudioGenerationState(storedMetadata);
    const persistedState = pendingGenerationId
      ? audioGenerationStateFromMetadata(storedMetadata, validSegments.length)
      : parseAudioGenerationState(body.continuation, validSegments.length);
    const initialState = persistedState || createAudioGenerationState(validSegments.length);
    const totalUnits = validSegments.length + 1;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          emitProgress(
            controller,
            initialState.nextSegmentIndex,
            totalUnits,
            'segments',
          );

          // Each request synthesizes at most two body chunks. It uploads and
          // checkpoints them before asking the browser to continue.
          if (initialState.nextSegmentIndex < validSegments.length) {
            const batchStart = initialState.nextSegmentIndex;
            const batch = validSegments.slice(batchStart, batchStart + BATCH_SIZE);
            const batchResults = await Promise.all(
              batch.map((segment) => {
                const sanitizedText = `${segment.text.trim()} ...`;
                return synthesize(sanitizedText, segment.voiceId, segment.provider);
              }),
            );
            const batchKeys = batchResults.map((_, offset) => (
              generationChunkKey(initialState.generationId, batchStart + offset)
            ));

            await Promise.all(batchResults.map((audio, index) => (
              uploadToR2(Buffer.from(audio), batchKeys[index])
            )));

            const nextState: AudioGenerationState = {
              ...initialState,
              chunkKeys: [...initialState.chunkKeys, ...batchKeys],
              nextSegmentIndex: batchStart + batch.length,
            };
            await persistPendingState(pendingGenerationId, metadata, nextState);

            emitProgress(controller, nextState.nextSegmentIndex, totalUnits, 'segments');
            emit(controller, {
              type: 'continue',
              continuation: nextState,
              done: nextState.nextSegmentIndex,
              total: totalUnits,
            });
            controller.close();
            return;
          }

          let finalState = initialState;
          if (!finalState.outroKey) {
            const lastSegment = validSegments[validSegments.length - 1];
            const outroText = '...... This was made with anoncast. If you want to convert a blog to audio, check out anoncast dot net. Thanks for listening!';
            try {
              const outroBuffer = await synthesize(
                outroText,
                lastSegment.voiceId,
                lastSegment.provider,
              );
              const outroKey = generationOutroKey(finalState.generationId);
              await uploadToR2(Buffer.from(outroBuffer), outroKey);
              finalState = { ...finalState, outroKey };
              await persistPendingState(pendingGenerationId, metadata, finalState);
            } catch (outroError) {
              console.warn('Outro generation failed; publishing body audio only:', outroError);
            }
          }

          emitProgress(controller, totalUnits, totalUnits, 'segments');
          emitProgress(controller, totalUnits, totalUnits, 'combining');

          const intermediateKeys = [
            ...finalState.chunkKeys,
            ...(finalState.outroKey ? [finalState.outroKey] : []),
          ];
          const audioBuffers = await Promise.all(
            intermediateKeys.map(downloadIntermediateChunk),
          );
          const finalAudio = await assembleMp3Chunks(audioBuffers);

          // Upload only after the final artifact has been encoded, probed, and
          // fully decoded once without structural MP3 warnings.
          emitProgress(controller, totalUnits, totalUnits, 'uploading');
          const fileName = `${crypto.randomUUID()}.mp3`;
          const audioUrl = await uploadToR2(finalAudio.buffer, fileName);
          const image = metadataString(metadata, 'image');
          let r2ImageUrl = image;

          // An image failure does not affect the validated audio. Keep the
          // original image URL as the fallback.
          if (image) {
            try {
              const imageResponse = await fetch(image);
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

          // The database insert is the publication boundary. RSS cannot expose
          // an episode before the validated artifact exists.
          const sourceUrl = metadataString(metadata, 'url');
          const { error: dbError } = await supabase.from('episodes').insert({
            show_id: GLOBAL_SHOW_ID,
            title: metadataString(metadata, 'title') || 'Untitled Episode',
            description: `Original blog: ${sourceUrl || 'Unknown source'}\n\n${metadataString(metadata, 'firstSentence') || ''}\n\nConvert your blog to audio at https://www.anoncast.net/ , or browse generated episodes at https://www.anoncast.net/generated`,
            audio_url: audioUrl,
            image_url: r2ImageUrl,
            ...finalAudioPersistenceFields(finalAudio),
            source_url: sourceUrl,
            voice_id: validSegments[0]?.voiceId || null,
          });
          if (dbError) {
            throw new Error(`Episode database insert failed after audio upload: ${dbError.message}`);
          }

          if (pendingGenerationId) {
            const { error: consumeError } = await supabase
              .from('pending_generations')
              .update({ consumed: true })
              .eq('id', pendingGenerationId)
              .eq('consumed', false);
            if (consumeError) {
              console.error('Pending generation completion update failed:', consumeError);
            }
          }

          // Intermediate objects are needed for safe retries until publication.
          // After the database boundary they can be removed without affecting
          // the immutable final episode URL.
          try {
            await deleteR2Objects(intermediateKeys);
          } catch (cleanupError) {
            console.warn('Intermediate audio cleanup failed:', cleanupError);
          }

          emit(controller, { type: 'complete', showId: GLOBAL_SHOW_ID, audioUrl });
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          emit(controller, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Generation failed',
          });
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
      { status: 500 },
    );
  }
}
