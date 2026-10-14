import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { buildSimulationInput } from '../core/build-simulation-input';
import { EquipmentSlot } from '../types';
import { CORPUS_CASES } from './corpus-cases';
import { CORPUS_CONTENT } from './corpus-content';
import type { CanonicalCheckpoint } from './parse-canonical-case-output';
import { parseCanonicalCaseOutput } from './parse-canonical-case-output';
import { runCorpusCase } from './run-corpus-case';

const TIE_CASE_IDS = [
  'event-tie-failed-short',
  'event-tie-failed-long',
  'event-tie-progress-cutoff',
];

test.each(TIE_CASE_IDS)(
  'it builds the %s case with the avatar weapon on the same attack interval as the fast-attack archetype',
  (id) => {
    const [archetype] = CORPUS_CONTENT['fast-attack'].archetypes;

    invariant(archetype, 'the fast-attack content must define an archetype');

    const tieCase = CORPUS_CASES.find((candidate) => candidate.id === id);

    invariant(tieCase, `unknown corpus case id: ${id}`);

    const built = buildSimulationInput(CORPUS_CONTENT[tieCase.contentID], tieCase.source, {
      failureAction: tieCase.failureAction,
    });

    const weapon = built.avatar.paperdoll[EquipmentSlot.MainHand];

    invariant(weapon, 'the tie case avatar must have a main-hand weapon');

    expect(Math.round(1000 / archetype.attackSpeed)).toBe(Math.round(1000 / weapon.speed));
  },
);

const THRESHOLD_CASE_IDS = ['threshold-one-below', 'threshold-exact'];

test.each(THRESHOLD_CASE_IDS)('it records a level-up checkpoint in the %s case', async (id) => {
  const canonicalString = await runCorpusCase(id);

  const canonical = parseCanonicalCaseOutput(canonicalString);

  expect(canonical.checkpoints).toSatisfyAny(
    (checkpoint: CanonicalCheckpoint) => checkpoint[6] !== null,
  );
});

const REPEATED_ACTIVITY_CASE_IDS = ['repeated-retry-long-a', 'repeated-retry-long-b'];

test.each(REPEATED_ACTIVITY_CASE_IDS)(
  'it plays through more than one activity attempt in the %s case',
  async (id) => {
    const canonicalString = await runCorpusCase(id);

    const canonical = parseCanonicalCaseOutput(canonicalString);

    const attemptCount = canonical.checkpoints.filter(
      (checkpoint) => checkpoint[0] === 'started',
    ).length;

    expect(attemptCount).toBeGreaterThan(1);
  },
);

test('it records a completed checkpoint in the clean-completion case', async () => {
  const canonicalString = await runCorpusCase('clean-completion');

  const canonical = parseCanonicalCaseOutput(canonicalString);

  expect(canonical.checkpoints).toSatisfyAny(
    (checkpoint: CanonicalCheckpoint) => checkpoint[0] === 'completed',
  );
});

const FAILED_TERMINAL_CASE_IDS = ['aborted-failure', 'same-tick-multi-enemy-avatar-death'];

test.each(FAILED_TERMINAL_CASE_IDS)('it records a failed checkpoint in the %s case', async (id) => {
  const canonicalString = await runCorpusCase(id);

  const canonical = parseCanonicalCaseOutput(canonicalString);

  expect(canonical.checkpoints).toSatisfyAny(
    (checkpoint: CanonicalCheckpoint) => checkpoint[0] === 'failed',
  );
});

test('it starts more than one attempt in the retrying-multi-attempt case', async () => {
  const canonicalString = await runCorpusCase('retrying-multi-attempt');

  const canonical = parseCanonicalCaseOutput(canonicalString);

  const startedCount = canonical.checkpoints.filter(
    (checkpoint) => checkpoint[0] === 'started',
  ).length;

  expect(startedCount).toBeGreaterThan(1);
});

test('it completes more than once in the multi-clear case', async () => {
  const canonicalString = await runCorpusCase('multi-clear');

  const canonical = parseCanonicalCaseOutput(canonicalString);

  const completedCount = canonical.checkpoints.filter(
    (checkpoint) => checkpoint[0] === 'completed',
  ).length;

  expect(completedCount).toBeGreaterThan(1);
});
