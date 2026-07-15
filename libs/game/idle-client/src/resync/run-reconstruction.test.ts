import { expect, test } from 'bun:test';
import { SIMULATION_TIMESTEP_MS, runAttempt } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { runReconstruction } from './run-reconstruction';

test('it reconstructs a simulation to the confirmed head, matching the original stream exactly', async () => {
  const activity = createMockActivityInput();
  const avatar = createMockAvatarData();

  const attempt = await runAttempt(activity, avatar, { maxDurationMs: 120_000 });

  expect(attempt.checkpoints.length).toBeGreaterThan(1);

  const targetHead = attempt.checkpoints.length - 1;

  const result = await runReconstruction({
    activity,
    appendedHead: targetHead,
    avatar,
  });

  if ('divergence' in result) {
    throw new Error('expected a reconstructed simulation, got a divergence');
  }

  const priorCheckpoint = attempt.checkpoints[targetHead - 1];
  const expectedNextCheckpoint = attempt.checkpoints[targetHead];

  if (priorCheckpoint === undefined || expectedNextCheckpoint === undefined) {
    throw new Error('expected both the prior and next original checkpoints to exist');
  }

  expect(result.lastCheckpoint.nextSeed).toBe(priorCheckpoint.nextSeed);

  let nextCheckpoint = null;

  while (nextCheckpoint === null) {
    nextCheckpoint = await result.simulation.run(SIMULATION_TIMESTEP_MS);
  }

  expect(nextCheckpoint).toStrictEqual(expectedNextCheckpoint);
});

test('it reports a divergence when the local engine terminates before the confirmed head', async () => {
  const activity = createMockActivityInput();
  const avatar = createMockAvatarData();

  const attempt = await runAttempt(activity, avatar, { maxDurationMs: 120_000 });

  const result = await runReconstruction({
    activity,
    appendedHead: attempt.checkpoints.length + 5,
    avatar,
  });

  expect(result).toStrictEqual({ divergence: true });
});
