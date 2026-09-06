import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '@vers/idle-core';
import { runOutcomeSchema } from '../../worker/run-outcome-schema';
import { createMockRunOutcome } from './create-mock-run-outcome';

test('it builds a default run outcome', () => {
  const outcome = createMockRunOutcome();

  expect(outcome).toStrictEqual({
    activityID: expect.toBeString(),
    avatarID: expect.toBeString(),
    kind: ActivityCheckpointType.Failed,
    xp: expect.toBeNumber(),
  });

  expect(runOutcomeSchema.parse(outcome)).toStrictEqual(outcome);
});

test('it applies overrides on top of the defaults', () => {
  const outcome = createMockRunOutcome({
    kind: ActivityCheckpointType.Completed,
    scope: { scopeID: '3_4', scopeType: 'world_map_node' },
    xp: 240,
  });

  expect(outcome).toStrictEqual({
    activityID: expect.toBeString(),
    avatarID: expect.toBeString(),
    kind: ActivityCheckpointType.Completed,
    scope: { scopeID: '3_4', scopeType: 'world_map_node' },
    xp: 240,
  });
});
