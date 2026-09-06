import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '@vers/idle-core';
import type { RunOutcome } from './run-outcome-schema';
import { runOutcomeSchema } from './run-outcome-schema';

test('it accepts a run outcome that names the node the ended run played', () => {
  const outcome: RunOutcome = {
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    kind: ActivityCheckpointType.Failed,
    scope: { scopeID: '0_0', scopeType: 'world_map_node' },
    xp: 118,
  };

  expect(runOutcomeSchema.parse(outcome)).toStrictEqual(outcome);
});

test('it accepts a run outcome with no node named', () => {
  const outcome: RunOutcome = {
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    kind: ActivityCheckpointType.Completed,
    xp: 0,
  };

  expect(runOutcomeSchema.parse(outcome)).toStrictEqual(outcome);
});

test('it rejects a run outcome whose kind is not terminal', () => {
  const result = runOutcomeSchema.safeParse({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    kind: ActivityCheckpointType.Progress,
    xp: 0,
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['kind'] }));
});

test('it rejects a run outcome that names no avatar', () => {
  const result = runOutcomeSchema.safeParse({
    activityID: 'activity_1',
    kind: ActivityCheckpointType.Failed,
    xp: 0,
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['avatarID'] }));
});
