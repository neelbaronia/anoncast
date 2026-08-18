export const MAX_TTS_REQUEST_CHARACTERS = 4_500;

export interface TtsSegment {
  confirmed?: boolean;
  provider?: string;
  text: string;
  voiceId: string;
}

function splitOversizedText(text: string, maxCharacters: number): string[] {
  const pieces: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxCharacters) {
    let splitAt = remaining.lastIndexOf(' ', maxCharacters);
    if (splitAt < Math.floor(maxCharacters * 0.6)) {
      splitAt = maxCharacters;
    }
    pieces.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    pieces.push(remaining);
  }
  return pieces;
}

function hasSameVoice(left: TtsSegment, right: TtsSegment): boolean {
  return left.voiceId === right.voiceId
    && (left.provider || '') === (right.provider || '');
}

export function coalesceTtsSegments(
  segments: readonly TtsSegment[],
  maxCharacters = MAX_TTS_REQUEST_CHARACTERS,
): TtsSegment[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 100) {
    throw new Error(`Invalid TTS request character limit: ${maxCharacters}`);
  }

  const result: TtsSegment[] = [];
  for (const segment of segments) {
    if (!segment.confirmed || !segment.voiceId || !segment.text?.trim()) {
      continue;
    }

    const pieces = splitOversizedText(segment.text, maxCharacters);
    for (const piece of pieces) {
      const next: TtsSegment = {
        confirmed: true,
        provider: segment.provider,
        text: piece,
        voiceId: segment.voiceId,
      };
      const previous = result[result.length - 1];
      const separator = ' ... ';

      if (
        previous
        && hasSameVoice(previous, next)
        && previous.text.length + separator.length + next.text.length <= maxCharacters
      ) {
        previous.text += separator + next.text;
      } else {
        result.push(next);
      }
    }
  }

  return result;
}
