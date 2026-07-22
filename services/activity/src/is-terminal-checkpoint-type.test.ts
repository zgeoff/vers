import { expect, test } from 'bun:test';
import { isTerminalCheckpointType } from './is-terminal-checkpoint-type';

test('it reports a completed checkpoint as ending its run', () => {
  expect(isTerminalCheckpointType('completed')).toBe(true);
});

test('it reports a failed checkpoint as ending its run', () => {
  expect(isTerminalCheckpointType('failed')).toBe(true);
});

test('it reports an ordinary tick as not ending its run', () => {
  expect(isTerminalCheckpointType('tick')).toBe(false);
});
