import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { formatItunesDuration, roundDurationForRss } from '../../src/lib/audio/duration';
import { finalAudioPersistenceFields } from '../../src/lib/audio/persistence';
import {
  assembleMp3Chunks,
  containsInvalidConcatenationWarning,
  findId3HeaderPositions,
  getMediaBinaryPaths,
  probeAudioFile,
} from '../../src/lib/audio/mp3';

const execFileAsync = promisify(execFile);

function markerPositions(buffer: Buffer, marker: string): number[] {
  const positions: number[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const position = buffer.indexOf(marker, offset, 'ascii');
    if (position === -1) break;
    positions.push(position);
    offset = position + marker.length;
  }
  return positions;
}

test('multi-chunk MP3 assembly produces one valid stream with probed RSS duration', { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'anoncast-mp3-test-'));
  const { ffmpeg } = getMediaBinaryPaths();
  const requestedDurations = [0.62, 0.77, 0.91];

  try {
    const chunks: Buffer[] = [];
    for (const [index, duration] of requestedDurations.entries()) {
      const chunkPath = path.join(directory, `chunk-${index}.mp3`);
      const inputSampleRate = index === 0 ? 22_050 : index === 1 ? 44_100 : 48_000;
      const inputChannels = index === 1 ? 2 : 1;
      await execFileAsync(ffmpeg, [
        '-hide_banner', '-nostdin', '-v', 'error', '-y',
        '-f', 'lavfi',
        '-i', `sine=frequency=${440 + index * 110}:sample_rate=${inputSampleRate}:duration=${duration}`,
        '-ac', String(inputChannels),
        '-c:a', 'libmp3lame',
        '-b:a', index === 0 ? '64k' : index === 1 ? '96k' : '128k',
        '-id3v2_version', '3',
        '-metadata', `title=chunk-${index}`,
        chunkPath,
      ]);
      chunks.push(await readFile(chunkPath));
    }

    assert.ok(chunks.every((chunk) => findId3HeaderPositions(chunk)[0] === 0));

    const artifact = await assembleMp3Chunks(chunks);
    const finalPath = path.join(directory, 'assembled.mp3');
    await writeFile(finalPath, artifact.buffer);

    const expectedDuration = requestedDurations.reduce((sum, duration) => sum + duration, 0);
    assert.ok(
      Math.abs(artifact.durationSeconds - expectedDuration) <= 0.2,
      `expected about ${expectedDuration}s, got ${artifact.durationSeconds}s`,
    );

    const decode = await execFileAsync(ffmpeg, [
      '-hide_banner', '-nostdin', '-v', 'warning', '-i', finalPath, '-map', '0:a:0', '-f', 'null', '-',
    ]);
    assert.equal(containsInvalidConcatenationWarning(decode.stderr), false, decode.stderr);

    const id3Positions = findId3HeaderPositions(artifact.buffer);
    assert.deepEqual(id3Positions, [0], `embedded ID3 headers at ${id3Positions.join(', ')}`);

    const streamHeaderCount = markerPositions(artifact.buffer, 'Info').length
      + markerPositions(artifact.buffer, 'Xing').length;
    assert.equal(streamHeaderCount, 1, 'expected exactly one Info/Xing stream header');

    const finalProbe = await probeAudioFile(finalPath);
    assert.equal(finalProbe.durationSeconds, artifact.durationSeconds);
    assert.equal(artifact.rssDurationSeconds, roundDurationForRss(finalProbe.durationSeconds));
    const storedAudio = finalAudioPersistenceFields(artifact);
    assert.equal(storedAudio.duration, roundDurationForRss(finalProbe.durationSeconds));
    assert.equal(storedAudio.file_size, finalProbe.sizeBytes);
    assert.equal(formatItunesDuration(storedAudio.duration), String(artifact.rssDurationSeconds));

    if (process.platform === 'darwin') {
      const verifier = path.resolve('scripts/verify-avfoundation-duration.swift');
      const avFoundation = await execFileAsync('swift', [
        verifier,
        finalPath,
        String(finalProbe.durationSeconds),
        '0.25',
      ]);
      const avFoundationDuration = Number.parseFloat(avFoundation.stdout.trim());
      assert.ok(Number.isFinite(avFoundationDuration));
      assert.ok(Math.abs(avFoundationDuration - finalProbe.durationSeconds) <= 0.25);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
