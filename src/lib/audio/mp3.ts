import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ffmpegPath as bundledFfmpegPath,
  ffprobePath as bundledFfprobePath,
} from 'ffmpeg-ffprobe-static';

import { roundDurationForRss } from './duration';

export const MP3_OUTPUT = {
  bitrate: '128k',
  bitrateBitsPerSecond: 128_000,
  channels: 1,
  sampleRate: 44_100,
} as const;

const INVALID_MP3_WARNING = /invalid concatenated file|header missing/i;
const PROCESS_TIMEOUT_MS = 5 * 60 * 1000;

export type AudioBytes = ArrayBuffer | ArrayBufferView;

export interface AudioProbe {
  bitrate: number | null;
  channels: number;
  codecName: string;
  durationSeconds: number;
  sampleRate: number;
  sizeBytes: number;
}

export interface FinalMp3Artifact {
  buffer: Buffer;
  durationSeconds: number;
  fileSize: number;
  probe: AudioProbe;
  rssDurationSeconds: number;
  validationWarnings: string;
}

interface ProcessResult {
  stderr: string;
  stdout: string;
}

interface ProcessOptions {
  cwd?: string;
  timeoutMs?: number;
}

function mediaBinaryPath(kind: 'ffmpeg' | 'ffprobe'): string {
  const override = kind === 'ffmpeg' ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH;
  const bundled = kind === 'ffmpeg' ? bundledFfmpegPath : bundledFfprobePath;
  const resolved = override || bundled;

  if (!resolved) {
    throw new Error(`${kind} executable is unavailable`);
  }

  return resolved;
}

export function getMediaBinaryPaths() {
  return {
    ffmpeg: mediaBinaryPath('ffmpeg'),
    ffprobe: mediaBinaryPath('ffprobe'),
  };
}

async function runProcess(
  command: string,
  args: readonly string[],
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs ?? PROCESS_TIMEOUT_MS);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      const result = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };

      if (code !== 0) {
        const reason = timedOut
          ? `timed out after ${options.timeoutMs ?? PROCESS_TIMEOUT_MS}ms`
          : `exited with code ${code}${signal ? ` (${signal})` : ''}`;
        reject(new Error(`${path.basename(command)} ${reason}: ${result.stderr.trim()}`));
        return;
      }

      resolve(result);
    });
  });
}

function toBuffer(bytes: AudioBytes): Buffer {
  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }

  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function parsePositiveNumber(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`ffprobe returned an invalid ${label}: ${String(value)}`);
  }
  return parsed;
}

export async function probeAudioFile(filePath: string): Promise<AudioProbe> {
  const { ffprobe } = getMediaBinaryPaths();
  const { stdout } = await runProcess(ffprobe, [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,sample_rate,channels',
    '-of', 'json',
    filePath,
  ]);

  let parsed: {
    format?: { bit_rate?: string; duration?: string; size?: string };
    streams?: Array<{ channels?: number; codec_name?: string; sample_rate?: string }>;
  };

  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Unable to parse ffprobe output for ${filePath}`);
  }

  const stream = parsed.streams?.[0];
  if (!stream) {
    throw new Error(`ffprobe found no audio stream in ${filePath}`);
  }

  return {
    bitrate: parsed.format?.bit_rate ? parsePositiveNumber(parsed.format.bit_rate, 'bitrate') : null,
    channels: parsePositiveNumber(stream.channels, 'channel count'),
    codecName: stream.codec_name || '',
    durationSeconds: parsePositiveNumber(parsed.format?.duration, 'duration'),
    sampleRate: parsePositiveNumber(stream.sample_rate, 'sample rate'),
    sizeBytes: parsePositiveNumber(parsed.format?.size, 'file size'),
  };
}

function findAsciiMarkers(buffer: Buffer, marker: string): number[] {
  const positions: number[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const position = buffer.indexOf(marker, offset, 'ascii');
    if (position === -1) {
      break;
    }
    positions.push(position);
    offset = position + marker.length;
  }
  return positions;
}

export function findId3HeaderPositions(buffer: Buffer): number[] {
  return findAsciiMarkers(buffer, 'ID3').filter((position) => {
    if (position + 10 > buffer.length) return false;
    const majorVersion = buffer[position + 3];
    const revision = buffer[position + 4];
    const sizeBytes = buffer.subarray(position + 6, position + 10);
    if (majorVersion < 2 || majorVersion > 4 || revision === 0xff) return false;
    if (sizeBytes.some((byte) => byte >= 0x80)) return false;

    const tagSize = sizeBytes.reduce((size, byte) => (size << 7) | byte, 0);
    return position + 10 + tagSize <= buffer.length;
  });
}

async function validateFinalMp3(filePath: string): Promise<{
  buffer: Buffer;
  probe: AudioProbe;
  warnings: string;
}> {
  const { ffmpeg } = getMediaBinaryPaths();
  const probe = await probeAudioFile(filePath);

  if (probe.codecName !== 'mp3') {
    throw new Error(`Expected MP3 output, received ${probe.codecName || 'unknown codec'}`);
  }
  if (probe.sampleRate !== MP3_OUTPUT.sampleRate || probe.channels !== MP3_OUTPUT.channels) {
    throw new Error(
      `Unexpected MP3 format: ${probe.sampleRate} Hz, ${probe.channels} channel(s)`,
    );
  }
  if (
    probe.bitrate != null
    && Math.abs(probe.bitrate - MP3_OUTPUT.bitrateBitsPerSecond) > 8_000
  ) {
    throw new Error(`Unexpected MP3 bitrate: ${probe.bitrate} bps`);
  }

  const decode = await runProcess(ffmpeg, [
    '-hide_banner',
    '-nostdin',
    '-v', 'warning',
    '-i', filePath,
    '-map', '0:a:0',
    '-f', 'null',
    '-',
  ]);

  if (INVALID_MP3_WARNING.test(decode.stderr)) {
    throw new Error(`Final MP3 failed structural validation: ${decode.stderr.trim()}`);
  }

  const buffer = await readFile(filePath);
  const id3Positions = findId3HeaderPositions(buffer);
  if (id3Positions.length !== 1 || id3Positions[0] !== 0) {
    throw new Error(`Final MP3 contains embedded ID3 headers at offsets ${id3Positions.join(', ')}`);
  }
  const streamHeaderCount = findAsciiMarkers(buffer, 'Info').length
    + findAsciiMarkers(buffer, 'Xing').length;
  if (streamHeaderCount !== 1) {
    throw new Error(`Final MP3 contains ${streamHeaderCount} Info/Xing stream headers`);
  }

  return { buffer, probe, warnings: decode.stderr.trim() };
}

async function encodeInputFiles(tempDirectory: string, inputFiles: string[]): Promise<string> {
  const { ffmpeg } = getMediaBinaryPaths();
  const finalPath = path.join(tempDirectory, 'final.mp3');
  const normalizedLabels = inputFiles.map((_, index) => `[normalized-${index}]`);
  const filter = [
    ...inputFiles.map((_, index) => (
      `[${index}:a:0]aresample=${MP3_OUTPUT.sampleRate},`
      + `aformat=sample_fmts=fltp:sample_rates=${MP3_OUTPUT.sampleRate}:channel_layouts=mono,`
      + `asetpts=PTS-STARTPTS${normalizedLabels[index]}`
    )),
    `${normalizedLabels.join('')}concat=n=${inputFiles.length}:v=0:a=1[final-audio]`,
  ].join(';');

  await runProcess(ffmpeg, [
    '-hide_banner',
    '-nostdin',
    '-v', 'error',
    '-y',
    ...inputFiles.flatMap((file) => ['-i', file]),
    '-filter_complex', filter,
    '-map_metadata', '-1',
    '-map', '[final-audio]',
    '-vn',
    '-sn',
    '-dn',
    '-ac', String(MP3_OUTPUT.channels),
    '-ar', String(MP3_OUTPUT.sampleRate),
    '-c:a', 'libmp3lame',
    '-b:a', MP3_OUTPUT.bitrate,
    '-write_xing', '1',
    '-id3v2_version', '3',
    '-metadata', 'encoder=Anoncast',
    finalPath,
  ], { cwd: tempDirectory });

  return finalPath;
}

async function createArtifact(finalPath: string): Promise<FinalMp3Artifact> {
  const validated = await validateFinalMp3(finalPath);
  const fileInfo = await stat(finalPath);

  if (fileInfo.size !== validated.buffer.byteLength || fileInfo.size !== validated.probe.sizeBytes) {
    throw new Error('Final MP3 size changed during validation');
  }

  return {
    buffer: validated.buffer,
    durationSeconds: validated.probe.durationSeconds,
    fileSize: fileInfo.size,
    probe: validated.probe,
    rssDurationSeconds: roundDurationForRss(validated.probe.durationSeconds),
    validationWarnings: validated.warnings,
  };
}

export async function assembleMp3Chunks(chunks: readonly AudioBytes[]): Promise<FinalMp3Artifact> {
  const nonEmptyChunks = chunks.map(toBuffer).filter((chunk) => chunk.byteLength > 0);
  if (nonEmptyChunks.length === 0) {
    throw new Error('Cannot assemble an MP3 without audio chunks');
  }

  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'anoncast-audio-'));

  try {
    const inputFiles: string[] = [];
    for (const [index, chunk] of nonEmptyChunks.entries()) {
      const inputPath = path.join(tempDirectory, `chunk-${index.toString().padStart(4, '0')}.mp3`);
      await writeFile(inputPath, chunk);
      inputFiles.push(inputPath);
    }

    const finalPath = await encodeInputFiles(tempDirectory, inputFiles);
    return await createArtifact(finalPath);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function repairMp3File(sourcePath: string): Promise<FinalMp3Artifact> {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'anoncast-repair-'));
  const normalizedSourcePath = path.join(tempDirectory, 'source.mp3');

  try {
    // A complete decode strips every ID3/Xing header embedded by the original
    // byte concatenation. FFmpeg decodes it and encodes one fresh MP3 stream.
    await copyFile(sourcePath, normalizedSourcePath);
    const finalPath = await encodeInputFiles(tempDirectory, [normalizedSourcePath]);
    return await createArtifact(finalPath);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export function containsInvalidConcatenationWarning(output: string): boolean {
  return INVALID_MP3_WARNING.test(output);
}
