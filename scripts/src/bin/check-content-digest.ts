import path from 'node:path';
import { BUNDLED_CONTENT_VERSION, CONTENT_VERSION_DIGESTS } from '@vers/content-version';
import { Command } from 'commander';
import { match } from 'ts-pattern';
import { buildContentDigest } from '../content/build-content-digest';
import { collectContentDigestFindings } from '../content/collect-content-digest-findings';
import { readContentSources } from '../content/read-content-sources';
import { readRecordedDigestsAt } from '../content/read-recorded-digests-at';
import type { ContentDigestFinding } from '../content/types';

// Fails when the item-gen, roll-crypto or worldmap-content sources differ from the digest recorded
// for the bundled content version, or when a digest recorded at the base ref changed, so a change
// to any of those packages ships as a new content version. Exits 1 on a finding.

interface CheckOptions {
  readonly base?: string;
}

const repoRoot = path.resolve(import.meta.dirname, '../../..');

const program = new Command()
  .name('check-content-digest')
  .description('fail when the content packages changed without a new content version')
  .option('--base <ref>', 'reject a change to any digest recorded at this git ref')
  .action(async (options: CheckOptions) => {
    const sources = await readContentSources(repoRoot);

    const digest = buildContentDigest(sources);

    const baseDigests =
      options.base === undefined ? {} : await readRecordedDigestsAt(options.base, repoRoot);

    const findings = collectContentDigestFindings({
      baseDigests,
      bundledContentVersion: BUNDLED_CONTENT_VERSION,
      digest,
      recordedDigests: CONTENT_VERSION_DIGESTS,
    });

    if (findings.length > 0) {
      console.error(findings.map((finding) => formatFinding(finding)).join('\n'));

      console.error(
        [
          'A change to @vers/item-gen, @vers/roll-crypto or @vers/worldmap-content ships as a new',
          'content version: keep the old interpreter, register the new one under the new version,',
          'bump BUNDLED_CONTENT_VERSION, and record the new digest under the new version. A recorded',
          'digest never changes.',
        ].join('\n'),
      );

      process.exit(1);
    }

    console.log(`content-digest: content version ${BUNDLED_CONTENT_VERSION} matches ${digest}`);
  });

await program.parseAsync();

function formatFinding(finding: ContentDigestFinding): string {
  return match(finding)
    .with(
      { kind: 'sources-drifted' },
      (drift) =>
        `content-digest: the content sources digest to ${drift.digest}, but content version ${drift.bundledContentVersion} records ${drift.recordedDigest ?? 'no digest'}.`,
    )
    .with(
      { kind: 'recorded-digest-rewritten' },
      (rewrite) =>
        `content-digest: content version ${rewrite.contentVersion} recorded ${rewrite.baseDigest} at the base ref, and the tree records ${rewrite.recordedDigest ?? 'no digest'}.`,
    )
    .exhaustive();
}
