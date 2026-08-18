import type { FinalMp3Artifact } from './mp3';

export function finalAudioPersistenceFields(
  artifact: Pick<FinalMp3Artifact, 'fileSize' | 'rssDurationSeconds'>,
) {
  return {
    duration: artifact.rssDurationSeconds,
    file_size: artifact.fileSize,
  };
}
