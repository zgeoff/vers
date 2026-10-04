import type { ActivityCheckpoint } from '../types';
import type { CanonicalCheckpoint } from './parse-canonical-case-output';
import type { CorpusCase, CorpusSimulationResult } from './types';

export function buildCanonicalCaseOutput(
  corpusCase: Readonly<CorpusCase>,
  result: Readonly<CorpusSimulationResult>,
): string {
  return JSON.stringify({
    id: corpusCase.id,
    elapsed: result.elapsed,
    halted: result.haltedOnDurationCap ?? false,
    checkpointCount: result.checkpoints.length,
    checkpoints: result.checkpoints.map(buildCanonicalCheckpoint),
  });
}

function buildCanonicalCheckpoint(checkpoint: Readonly<ActivityCheckpoint>): CanonicalCheckpoint {
  return [
    checkpoint.type,
    checkpoint.time,
    checkpoint.nextSeed,
    'seed' in checkpoint ? checkpoint.seed : null,
    checkpoint.rewards.xp,
    checkpoint.rewardSlots.map((slot): [number, number] => [slot.ordinal, slot.context.nodeTier]),
    checkpoint.levelUp ? [checkpoint.levelUp.from, checkpoint.levelUp.to] : null,
  ];
}
