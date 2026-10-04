import { expect, test } from 'bun:test';
import { createMockCorpusCase } from '../test-utils/factories/create-mock-corpus-case';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/factories/create-mock-started-checkpoint';
import { buildCanonicalCaseOutput } from './build-canonical-case-output';
import { parseCanonicalCaseOutput } from './parse-canonical-case-output';

test('it renders every checkpoint field into its fixed tuple position', () => {
  const corpusCase = createMockCorpusCase({ id: 'canonical-shape' });

  const checkpoint = createMockProgressCheckpoint({
    levelUp: { from: 4, to: 5 },
    nextSeed: 'seed-next',
    rewards: { xp: 18 },
    rewardSlots: [{ context: { nodeTier: 2 }, ordinal: 0 }],
    time: 2500,
  });

  const canonical = parseCanonicalCaseOutput(
    buildCanonicalCaseOutput(corpusCase, { checkpoints: [checkpoint], elapsed: 2600 }),
  );

  expect(canonical).toStrictEqual({
    id: 'canonical-shape',
    elapsed: 2600,
    halted: false,
    checkpointCount: 1,
    checkpoints: [['progress', 2500, 'seed-next', null, 18, [[0, 2]], [4, 5]]],
  });
});

test('it carries the started checkpoint seed and an empty level-up as null', () => {
  const corpusCase = createMockCorpusCase({ id: 'canonical-started' });
  const checkpoint = createMockStartedCheckpoint({ nextSeed: 'seed-1', seed: 'seed-0', time: 0 });

  const canonical = parseCanonicalCaseOutput(
    buildCanonicalCaseOutput(corpusCase, { checkpoints: [checkpoint], elapsed: 0 }),
  );

  expect(canonical.checkpoints).toStrictEqual([['started', 0, 'seed-1', 'seed-0', 0, [], null]]);
});

test('it defaults the halted flag to false when the simulation result omits it', () => {
  const corpusCase = createMockCorpusCase();

  const canonical = parseCanonicalCaseOutput(
    buildCanonicalCaseOutput(corpusCase, { checkpoints: [], elapsed: 0 }),
  );

  expect(canonical.halted).toBe(false);
});

test('it carries a true halted flag through from the simulation result', () => {
  const corpusCase = createMockCorpusCase();

  const canonical = parseCanonicalCaseOutput(
    buildCanonicalCaseOutput(corpusCase, {
      checkpoints: [],
      elapsed: 0,
      haltedOnDurationCap: true,
    }),
  );

  expect(canonical.halted).toBe(true);
});
