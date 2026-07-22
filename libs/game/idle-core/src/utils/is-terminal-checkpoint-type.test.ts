import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '../types';
import { isTerminalCheckpointType } from './is-terminal-checkpoint-type';

test('it identifies the types that end a run', () => {
  expect(isTerminalCheckpointType(ActivityCheckpointType.Completed)).toBeTrue();
  expect(isTerminalCheckpointType(ActivityCheckpointType.Failed)).toBeTrue();
});

test('it rejects every other checkpoint type', () => {
  expect(isTerminalCheckpointType(ActivityCheckpointType.Started)).toBeFalse();
  expect(isTerminalCheckpointType(ActivityCheckpointType.Progress)).toBeFalse();
});

test('it rejects a type the simulation never emits', () => {
  expect(isTerminalCheckpointType('tick')).toBeFalse();
});
