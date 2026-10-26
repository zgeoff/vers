import { expect, test } from 'bun:test';
import { isActivityStatusMove } from './is-activity-status-move';

test.each([
  ['active', 'stopped', true],
  ['active', 'capped', true],
  ['active', 'parked', true],
  ['active', 'quarantined', true],
  ['active', 'rejected', true],
  ['stopped', 'parked', true],
  ['stopped', 'quarantined', true],
  ['stopped', 'rejected', true],
  ['capped', 'parked', true],
  ['capped', 'quarantined', true],
  ['capped', 'rejected', true],
  ['parked', 'active', true],
  ['parked', 'stopped', true],
  ['parked', 'capped', true],
  ['stopped', 'active', false],
  ['capped', 'active', false],
  ['stopped', 'capped', false],
  ['parked', 'rejected', false],
  ['parked', 'quarantined', false],
  ['rejected', 'active', false],
  ['rejected', 'stopped', false],
  ['quarantined', 'active', false],
  ['quarantined', 'rejected', false],
  ['active', 'active', false],
] as const)('it answers a move from %s to %s with %p', (from, to, expected) => {
  expect(isActivityStatusMove(from, to)).toBe(expected);
});
