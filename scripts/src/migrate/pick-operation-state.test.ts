import { expect, test } from 'bun:test';
import { pickOperationState } from './pick-operation-state';

test.each<[string, ReturnType<typeof pickOperationState>]>([
  ['finished', 'done'],
  ['skipped', 'done'],
  ['failed', 'failed'],
  ['error', 'failed'],
  ['cancelling', 'failed'],
  ['cancelled', 'failed'],
  ['scheduling', 'pending'],
  ['running', 'pending'],
])('it reads a Neon operation in status %s as %s', (status, state) => {
  expect(pickOperationState(status)).toBe(state);
});
