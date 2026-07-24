import { expect, test } from 'bun:test';
import { parseTerminalCheckpointXP } from './parse-terminal-checkpoint-xp';

test('it reads the xp total off a completed checkpoint payload', () => {
  expect(parseTerminalCheckpointXP({ rewards: { xp: 42 }, type: 'completed' })).toBe(42);
});

test('it reads the xp total off a failed checkpoint payload', () => {
  expect(parseTerminalCheckpointXP({ rewards: { xp: 7 }, type: 'failed' })).toBe(7);
});

test('it reports undefined for a non-terminal checkpoint type', () => {
  expect(parseTerminalCheckpointXP({ rewards: { xp: 42 }, type: 'progress' })).toBeUndefined();
});

test('it reports undefined for a payload missing rewards', () => {
  expect(parseTerminalCheckpointXP({ type: 'completed' })).toBeUndefined();
});

test('it reports undefined for a non-object payload', () => {
  expect(parseTerminalCheckpointXP('not-a-payload')).toBeUndefined();
});

test('it reports undefined for null', () => {
  expect(parseTerminalCheckpointXP(null)).toBeUndefined();
});
