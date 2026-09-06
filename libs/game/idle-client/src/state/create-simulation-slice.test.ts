import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { createSimulationSlice } from './create-simulation-slice';

test('it builds the empty simulation state', () => {
  expect(createSimulationSlice()).toStrictEqual({
    activity: null,
    avatar: null,
    combat: null,
    failureAction: ActivityFailureAction.Abort,
    liveRun: null,
  });
});
