import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coalesceTtsSegments,
  MAX_TTS_REQUEST_CHARACTERS,
  type TtsSegment,
} from '../../src/lib/tts-segments';

test('coalesces long same-voice articles into bounded TTS requests', () => {
  const original: TtsSegment[] = Array.from({ length: 220 }, (_, index) => ({
    confirmed: true,
    provider: 'elevenlabs',
    text: `paragraph-${index} ${'content '.repeat(40)}`.trim(),
    voiceId: 'voice-one',
  }));

  const coalesced = coalesceTtsSegments(original);
  assert.ok(coalesced.length < 25, `expected fewer than 25 requests, got ${coalesced.length}`);
  assert.ok(coalesced.every((segment) => segment.text.length <= MAX_TTS_REQUEST_CHARACTERS));

  let previousPosition = -1;
  for (let index = 0; index < original.length; index += 1) {
    const position = coalesced.map((segment) => segment.text).join(' ').indexOf(`paragraph-${index} `);
    assert.ok(position > previousPosition, `paragraph-${index} was lost or reordered`);
    previousPosition = position;
  }
});

test('preserves voice boundaries and splits a single oversized segment', () => {
  const coalesced = coalesceTtsSegments([
    { confirmed: true, provider: 'elevenlabs', text: 'first', voiceId: 'voice-one' },
    { confirmed: true, provider: 'elevenlabs', text: 'second', voiceId: 'voice-two' },
    { confirmed: true, provider: 'elevenlabs', text: 'word '.repeat(1_200), voiceId: 'voice-two' },
  ]);

  assert.equal(coalesced[0].voiceId, 'voice-one');
  assert.ok(coalesced.slice(1).every((segment) => segment.voiceId === 'voice-two'));
  assert.ok(coalesced.every((segment) => segment.text.length <= MAX_TTS_REQUEST_CHARACTERS));
});
