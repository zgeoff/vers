import type { ContentDigestDrift } from './types';

interface FindContentDigestDriftInput {
  readonly bundledContentVersion: string;
  readonly digest: string;
  readonly recordedDigests: Readonly<Record<string, string>>;
}

export function findContentDigestDrift(
  input: Readonly<FindContentDigestDriftInput>,
): ContentDigestDrift | undefined {
  const recordedDigest = input.recordedDigests[input.bundledContentVersion];

  if (recordedDigest === input.digest) {
    return undefined;
  }

  return {
    bundledContentVersion: input.bundledContentVersion,
    digest: input.digest,
    recordedDigest,
  };
}
