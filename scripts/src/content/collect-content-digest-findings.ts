import type { ContentDigestFinding } from './types';

interface CollectContentDigestFindingsInput {
  readonly baseDigests: Readonly<Record<string, string>>;
  readonly bundledContentVersion: string;
  readonly digest: string;
  readonly recordedDigests: Readonly<Record<string, string>>;
}

export function collectContentDigestFindings(
  input: Readonly<CollectContentDigestFindingsInput>,
): ReadonlyArray<ContentDigestFinding> {
  const findings: Array<ContentDigestFinding> = [];

  for (const [contentVersion, baseDigest] of Object.entries(input.baseDigests)) {
    const recordedDigest = input.recordedDigests[contentVersion];

    if (recordedDigest !== baseDigest) {
      findings.push({
        kind: 'recorded-digest-rewritten',
        baseDigest,
        contentVersion,
        recordedDigest,
      });
    }
  }

  const recordedDigest = input.recordedDigests[input.bundledContentVersion];

  if (recordedDigest !== input.digest) {
    findings.push({
      kind: 'sources-drifted',
      bundledContentVersion: input.bundledContentVersion,
      digest: input.digest,
      recordedDigest,
    });
  }

  return findings;
}
