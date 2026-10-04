import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { CORPUS_CASES } from '@vers/idle-core/corpus/corpus-cases';
import { parseCanonicalCaseOutput } from '@vers/idle-core/corpus/parse-canonical-case-output';
import type { CorpusCaseDigest } from '@vers/idle-core/corpus/run-corpus';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import { expect, test } from '../src/test';

const CorpusDigestsSchema = z.array(z.object({ digest: z.string(), id: z.string() }));

declare global {
  // a browser bundle built from this module (libs/game/idle-core/src/corpus/register-corpus-
  // global.ts) assigns these two functions before this spec reads them
  var runCorpus: () => Promise<ReadonlyArray<CorpusCaseDigest>>;
  var runCorpusCase: (id: string) => Promise<string>;
}

const CORPUS_DIR = path.join(import.meta.dirname, '..', '.corpus');
const BUNDLE_PATH = path.join(CORPUS_DIR, 'bundle.js');
const BUN_DIGESTS_PATH = path.join(CORPUS_DIR, 'bun-digests.json');

test('it matches the Bun corpus digests in this browser engine', async ({
  page,
  browserName,
}, testInfo) => {
  const bunDigestsRaw = await readFile(BUN_DIGESTS_PATH, 'utf8');

  const bunDigests: ReadonlyArray<CorpusCaseDigest> = CorpusDigestsSchema.parse(
    JSON.parse(bunDigestsRaw),
  );

  const bundleSource = await readFile(BUNDLE_PATH, 'utf8');

  await page.goto('/');
  await page.addScriptTag({ content: bundleSource });

  const browserDigests = await page.evaluate(() => globalThis.runCorpus());

  try {
    expect(browserDigests).toStrictEqual(bunDigests);
  } catch {
    await checkCorpusMismatch({ browserDigests, browserName, bunDigests, page }, testInfo);
  }
});

interface CorpusMismatchContext {
  readonly browserDigests: ReadonlyArray<CorpusCaseDigest>;
  readonly browserName: string;
  readonly bunDigests: ReadonlyArray<CorpusCaseDigest>;
  readonly page: Page;
}

async function checkCorpusMismatch(
  context: Readonly<CorpusMismatchContext>,
  testInfo: TestInfo,
): Promise<never> {
  const maxDigestCount = Math.max(context.bunDigests.length, context.browserDigests.length);

  const mismatchIndex = Array.from({ length: maxDigestCount }, (_, index) => index).findIndex(
    (index) =>
      context.bunDigests[index]?.id !== context.browserDigests[index]?.id ||
      context.bunDigests[index]?.digest !== context.browserDigests[index]?.digest,
  );

  invariant(mismatchIndex !== -1, 'a failed digest comparison must contain a differing entry');

  const mismatchedEntry =
    context.bunDigests[mismatchIndex] ?? context.browserDigests[mismatchIndex];

  invariant(mismatchedEntry, 'the diverging index must name a digest entry');

  const caseID = mismatchedEntry.id;
  const corpusCase = CORPUS_CASES.find((candidate) => candidate.id === caseID);

  invariant(
    corpusCase,
    `the Bun digest artifact must name a case the corpus still defines: ${caseID}`,
  );

  const browserCanonicalRaw = await context.page.evaluate(
    (id) => globalThis.runCorpusCase(id),
    caseID,
  );

  const bunCanonicalRaw = runBunCanonicalForCase(caseID);
  const browserCheckpoints = parseCanonicalCaseOutput(browserCanonicalRaw).checkpoints;
  const bunCheckpoints = parseCanonicalCaseOutput(bunCanonicalRaw).checkpoints;

  const firstUnequalIndex = bunCheckpoints.findIndex(
    (checkpoint, index) => JSON.stringify(checkpoint) !== JSON.stringify(browserCheckpoints[index]),
  );

  // an equal shared prefix with a length mismatch still diverges, at the first index only one
  // side has a checkpoint for
  const firstDivergingCheckpointIndex =
    firstUnequalIndex === -1
      ? Math.min(bunCheckpoints.length, browserCheckpoints.length)
      : firstUnequalIndex;

  await testInfo.attach('bun-canonical.json', {
    body: bunCanonicalRaw,
    contentType: 'application/json',
  });

  await testInfo.attach(`${context.browserName}-canonical.json`, {
    body: browserCanonicalRaw,
    contentType: 'application/json',
  });

  throw new Error(
    [
      `${context.browserName} diverged from Bun on corpus case "${caseID}"`,
      `first differing checkpoint index: ${firstDivergingCheckpointIndex}`,
      `bun checkpoint: ${JSON.stringify(bunCheckpoints[firstDivergingCheckpointIndex])}`,
      `${context.browserName} checkpoint: ${JSON.stringify(browserCheckpoints[firstDivergingCheckpointIndex])}`,
      `case input: ${JSON.stringify(corpusCase.source)}`,
    ].join('\n'),
  );
}

function runBunCanonicalForCase(caseID: string): string {
  const script = `import('@vers/idle-core/corpus/run-corpus-case').then(({ runCorpusCase }) => runCorpusCase(${JSON.stringify(caseID)})).then((canonical) => { process.stdout.write(canonical); });`;
  const result = spawnSync('bun', ['-e', script], { cwd: import.meta.dirname, encoding: 'utf8' });

  invariant(
    result.status === 0,
    `reading the Bun canonical string for ${caseID} must exit cleanly`,
  );

  return result.stdout;
}
