import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUDIO_GENERATION_STATE_KEY,
  audioGenerationStateFromMetadata,
  createAudioGenerationState,
  generationChunkKey,
  generationOutroKey,
  metadataWithAudioGenerationState,
  metadataWithoutAudioGenerationState,
  parseAudioGenerationState,
} from '../../src/lib/audio/generation-state';

const generationId = '8d5c2d8a-7b8b-4f68-9a33-24aa54af415d';

test('validates resumable generation chunk references', () => {
  const initial = createAudioGenerationState(3, generationId);
  assert.equal(initial.nextSegmentIndex, 0);

  const resumed = {
    ...initial,
    chunkKeys: [
      generationChunkKey(generationId, 0),
      generationChunkKey(generationId, 1),
    ],
    nextSegmentIndex: 2,
  };
  assert.deepEqual(parseAudioGenerationState(resumed, 3), resumed);

  assert.throws(
    () => parseAudioGenerationState({
      ...resumed,
      chunkKeys: ['https://example.com/untrusted.mp3', resumed.chunkKeys[1]],
    }, 3),
    /chunk reference/,
  );
});

test('keeps resumable state private from episode metadata', () => {
  const state = {
    ...createAudioGenerationState(1, generationId),
    chunkKeys: [generationChunkKey(generationId, 0)],
    nextSegmentIndex: 1,
    outroKey: generationOutroKey(generationId),
  };
  const stored = metadataWithAudioGenerationState({ title: 'Article' }, state);
  assert.deepEqual(audioGenerationStateFromMetadata(stored, 1), state);
  assert.deepEqual(metadataWithoutAudioGenerationState(stored), { title: 'Article' });
  assert.ok(AUDIO_GENERATION_STATE_KEY in stored);
});
