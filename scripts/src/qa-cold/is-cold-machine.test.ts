import { expect, test } from 'bun:test';
import { isColdMachine } from './is-cold-machine';

test.each([
  ['suspended', true],
  ['stopped', true],
  ['started', false],
  ['starting', false],
  ['replacing', false],
])('it reports a %s machine as cold: %p', (state, cold) => {
  expect(isColdMachine({ state })).toBe(cold);
});
