export function roundDurationForRss(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new Error(`Invalid audio duration: ${durationSeconds}`);
  }

  return Math.round(durationSeconds);
}

export function formatItunesDuration(durationSeconds: number | null | undefined): string {
  if (durationSeconds == null) {
    return '0';
  }

  return roundDurationForRss(durationSeconds).toString();
}
