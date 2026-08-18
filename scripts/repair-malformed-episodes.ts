import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

import { assembleMp3Chunks, repairMp3File, type FinalMp3Artifact } from '../src/lib/audio/mp3';

loadEnvConfig(process.cwd());

interface Arguments {
  chunks: string[];
  episodeId?: string;
  help: boolean;
  output?: string;
  source?: string;
  write: boolean;
}

const USAGE = `Usage:
  npm run repair:mp3 -- --source <mp3-url-or-path> [--output <path>]
  npm run repair:mp3 -- --chunk <url-or-path> --chunk <url-or-path> [--output <path>]
  npm run repair:mp3 -- --episode-id <uuid> [--write] [--output <path>]

Defaults to dry-run mode. Dry runs download/read, repair, probe, and validate audio
without modifying R2 or Supabase. --write requires --episode-id and uploads a new,
content-versioned object before atomically changing that episode's URL/duration/size.

When original chunks are supplied with --chunk they are preferred. Otherwise the
existing MP3 is completely decoded and re-encoded.`;

function parseArguments(argv: string[]): Arguments {
  const parsed: Arguments = { chunks: [], help: false, write: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') {
      parsed.write = true;
    } else if (argument === '--help' || argument === '-h') {
      parsed.help = true;
    } else if (argument === '--source' || argument === '--episode-id' || argument === '--output' || argument === '--chunk') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      if (argument === '--source') parsed.source = value;
      if (argument === '--episode-id') parsed.episodeId = value;
      if (argument === '--output') parsed.output = value;
      if (argument === '--chunk') parsed.chunks.push(value);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return parsed;
}

async function materializeSource(source: string, targetPath: string): Promise<void> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to download ${source}: HTTP ${response.status}`);
    }
    await writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
    return;
  }

  await access(source, constants.R_OK);
  await writeFile(targetPath, await readFile(source));
}

async function loadEpisode(episodeId: string): Promise<{ audio_url: string; id: string }> {
  const { supabase } = await import('../src/lib/supabase');
  const { data, error } = await supabase
    .from('episodes')
    .select('id,audio_url')
    .eq('id', episodeId)
    .single();

  if (error || !data?.audio_url) {
    throw new Error(`Unable to load episode ${episodeId}: ${error?.message || 'audio URL is missing'}`);
  }

  return data;
}

async function updateProductionEpisode(
  episodeId: string,
  artifact: FinalMp3Artifact,
): Promise<string> {
  const hash = createHash('sha256').update(artifact.buffer).digest('hex').slice(0, 16);
  const versionedKey = `repairs/${episodeId}/${hash}-${randomUUID()}.mp3`;
  const [{ uploadToR2 }, { supabase }] = await Promise.all([
    import('../src/lib/storage'),
    import('../src/lib/supabase'),
  ]);
  const audioUrl = await uploadToR2(artifact.buffer, versionedKey);

  const { error } = await supabase
    .from('episodes')
    .update({
      audio_url: audioUrl,
      duration: artifact.rssDurationSeconds,
      file_size: artifact.fileSize,
    })
    .eq('id', episodeId);

  if (error) {
    throw new Error(
      `The repaired object was uploaded to ${audioUrl}, but the episode update failed: ${error.message}`,
    );
  }

  return audioUrl;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (args.write && !args.episodeId) {
    throw new Error('--write requires --episode-id');
  }
  if (args.chunks.length === 1) {
    throw new Error('Provide at least two --chunk values, or use --source for one existing MP3');
  }

  let source = args.source;
  if (args.episodeId && (!source || args.write)) {
    const episode = await loadEpisode(args.episodeId);
    source ||= episode.audio_url;
  }
  if (args.chunks.length === 0 && !source) {
    throw new Error(`No audio source provided.\n\n${USAGE}`);
  }

  const workDirectory = await mkdtemp(path.join(tmpdir(), 'anoncast-repair-cli-'));
  try {
    let artifact: FinalMp3Artifact;
    let repairStrategy: 'original-chunks' | 'decode-reencode';

    if (args.chunks.length > 0) {
      repairStrategy = 'original-chunks';
      const chunkBuffers: Buffer[] = [];
      for (const [index, chunk] of args.chunks.entries()) {
        const chunkPath = path.join(workDirectory, `original-${index.toString().padStart(4, '0')}.mp3`);
        await materializeSource(chunk, chunkPath);
        chunkBuffers.push(await readFile(chunkPath));
      }
      artifact = await assembleMp3Chunks(chunkBuffers);
    } else {
      repairStrategy = 'decode-reencode';
      const sourcePath = path.join(workDirectory, 'source.mp3');
      await materializeSource(source!, sourcePath);
      artifact = await repairMp3File(sourcePath);
    }

    if (args.output) {
      const outputPath = path.resolve(args.output);
      await writeFile(outputPath, artifact.buffer, { flag: 'wx' });
    }

    let publishedUrl: string | undefined;
    if (args.write) {
      publishedUrl = await updateProductionEpisode(args.episodeId!, artifact);
    }

    console.log(JSON.stringify({
      mode: args.write ? 'production-write' : 'dry-run',
      strategy: repairStrategy,
      durationSeconds: artifact.durationSeconds,
      rssDurationSeconds: artifact.rssDurationSeconds,
      fileSize: artifact.fileSize,
      sampleRate: artifact.probe.sampleRate,
      channels: artifact.probe.channels,
      bitrate: artifact.probe.bitrate,
      validationWarnings: artifact.validationWarnings,
      localOutput: args.output ? path.resolve(args.output) : null,
      publishedUrl: publishedUrl || null,
      cacheBehavior: publishedUrl
        ? 'Episode now references a new immutable object URL; cached bytes at the old URL are bypassed.'
        : 'No CDN or production data changed.',
    }, null, 2));
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
