# Audio assembly and malformed MP3 repair

## Generation contract

ElevenLabs returns an independently encoded MP3 for every requested segment. The
generation endpoint must never append those response bodies as bytes. It instead:

1. writes each chunk into a unique temporary directory;
2. decodes and normalizes each chunk to 44.1 kHz mono PCM;
3. concatenates the normalized streams and encodes one 128 kbps MP3;
4. probes and fully decodes the final file to validate its duration and structure;
5. uploads that validated file; and
6. stores the rounded probed duration and actual file size before RSS can publish it.

Temporary files are removed on success and failure. `FFMPEG_PATH` and
`FFPROBE_PATH` may override the bundled binaries for local diagnostics.

## Regression and macOS checks

Run the cross-platform regression test:

```sh
npm run test:media
```

On macOS the test also loads the result with `AVURLAsset`. A repaired or generated
file can be checked manually with:

```sh
npm run verify:avfoundation -- /absolute/path/to/episode.mp3 86.67 0.25
```

The final two arguments are the expected seconds and permitted tolerance.

## Repair command

The repair command is dry-run by default. It never writes to R2 or Supabase unless
`--write` is supplied. Use an output path that does not already exist:

```sh
npm run repair:mp3 -- \
  --source https://example.com/malformed.mp3 \
  --output /tmp/episode.repaired.mp3
```

Original chunks are preferred when retained outside the current database schema:

```sh
npm run repair:mp3 -- \
  --chunk /path/to/chunk-1.mp3 \
  --chunk /path/to/chunk-2.mp3 \
  --output /tmp/episode.repaired.mp3
```

Production repair requires an explicit episode ID and write flag:

```sh
npm run repair:mp3 -- --episode-id EPISODE_UUID --write
```

That mode validates first, uploads a new object under
`repairs/<episode-id>/<content-hash>-<uuid>.mp3`, and only then changes the episode
row. The new immutable URL bypasses any cached bytes at the old R2/CDN URL. If the
database update fails, the old episode row remains unchanged and the command reports
the orphaned new object URL for cleanup.
