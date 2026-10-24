import path from 'node:path';
import { BUNDLED_CONTENT_VERSION, CONTENT_VERSION_DIGESTS } from '@vers/content-version';
import { buildContentDigest } from '../content/build-content-digest';
import { findContentDigestDrift } from '../content/find-content-digest-drift';
import { readContentSources } from '../content/read-content-sources';

// Fails when the item-gen, roll-crypto or worldmap-content sources differ from the digest recorded
// for the bundled content version, so a change to any of them ships as a new content version.
// Exits 1 on drift.

const repoRoot = path.resolve(import.meta.dirname, '../../..');

const sources = await readContentSources(repoRoot);

const digest = buildContentDigest(sources);

const drift = findContentDigestDrift({
  bundledContentVersion: BUNDLED_CONTENT_VERSION,
  digest,
  recordedDigests: CONTENT_VERSION_DIGESTS,
});

if (drift !== undefined) {
  console.error(
    [
      `content-digest: the content sources digest to ${drift.digest}, but content version ${drift.bundledContentVersion} records ${drift.recordedDigest ?? 'no digest'}.`,
      'A change to @vers/item-gen, @vers/roll-crypto or @vers/worldmap-content ships as a new content',
      'version: keep the old interpreter, register the new one under the new version, bump',
      'BUNDLED_CONTENT_VERSION, and',
      `record ${drift.digest} under the new version in CONTENT_VERSION_DIGESTS.`,
    ].join('\n'),
  );

  process.exit(1);
}

console.log(`content-digest: content version ${BUNDLED_CONTENT_VERSION} matches ${digest}`);
