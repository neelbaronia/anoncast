import { randomUUID } from 'node:crypto';

export const AUDIO_GENERATION_STATE_KEY = '_audioGeneration';

export interface AudioGenerationState {
  version: 1;
  generationId: string;
  chunkKeys: string[];
  nextSegmentIndex: number;
  totalSegments: number;
  outroKey?: string;
}

const GENERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generationChunkKey(generationId: string, index: number): string {
  return `generation-chunks/${generationId}/body-${index.toString().padStart(4, '0')}.mp3`;
}

export function generationOutroKey(generationId: string): string {
  return `generation-chunks/${generationId}/outro.mp3`;
}

export function createAudioGenerationState(
  totalSegments: number,
  generationId = randomUUID(),
): AudioGenerationState {
  if (!Number.isInteger(totalSegments) || totalSegments <= 0) {
    throw new Error(`Invalid generation segment count: ${totalSegments}`);
  }
  return {
    version: 1,
    generationId,
    chunkKeys: [],
    nextSegmentIndex: 0,
    totalSegments,
  };
}

export function parseAudioGenerationState(
  value: unknown,
  expectedTotalSegments: number,
): AudioGenerationState | null {
  if (value == null) return null;
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid audio generation continuation');
  }

  const candidate = value as Partial<AudioGenerationState>;
  if (
    candidate.version !== 1
    || typeof candidate.generationId !== 'string'
    || !GENERATION_ID_PATTERN.test(candidate.generationId)
    || !Number.isInteger(candidate.nextSegmentIndex)
    || candidate.nextSegmentIndex! < 0
    || candidate.nextSegmentIndex! > expectedTotalSegments
    || candidate.totalSegments !== expectedTotalSegments
    || !Array.isArray(candidate.chunkKeys)
    || candidate.chunkKeys.length !== candidate.nextSegmentIndex
  ) {
    throw new Error('Invalid audio generation continuation');
  }

  const chunkKeys = candidate.chunkKeys as unknown[];
  for (const [index, key] of chunkKeys.entries()) {
    if (key !== generationChunkKey(candidate.generationId, index)) {
      throw new Error('Invalid audio generation chunk reference');
    }
  }

  if (
    candidate.outroKey !== undefined
    && (
      candidate.nextSegmentIndex !== expectedTotalSegments
      || candidate.outroKey !== generationOutroKey(candidate.generationId)
    )
  ) {
    throw new Error('Invalid audio generation outro reference');
  }

  return {
    version: 1,
    generationId: candidate.generationId,
    chunkKeys: chunkKeys as string[],
    nextSegmentIndex: candidate.nextSegmentIndex!,
    totalSegments: candidate.totalSegments,
    ...(candidate.outroKey ? { outroKey: candidate.outroKey } : {}),
  };
}

export function metadataWithAudioGenerationState(
  metadata: unknown,
  state: AudioGenerationState,
): Record<string, unknown> {
  const source = metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
  return { ...source, [AUDIO_GENERATION_STATE_KEY]: state };
}

export function metadataWithoutAudioGenerationState(metadata: unknown): Record<string, unknown> {
  const source = metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
  const publicMetadata = { ...source };
  delete publicMetadata[AUDIO_GENERATION_STATE_KEY];
  return publicMetadata;
}

export function audioGenerationStateFromMetadata(
  metadata: unknown,
  expectedTotalSegments: number,
): AudioGenerationState | null {
  const source = metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
  return parseAudioGenerationState(
    source[AUDIO_GENERATION_STATE_KEY],
    expectedTotalSegments,
  );
}
