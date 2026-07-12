import { expect, test } from 'bun:test';
import { buildCompletionXP } from './build-completion-xp';

test('it scales up with difficulty', () => {
  const higher = buildCompletionXP(2);
  const lower = buildCompletionXP(1);

  expect(higher).toBeGreaterThan(lower);
});

test('it never returns negative xp for a non-negative difficulty', () => {
  expect(buildCompletionXP(0)).toBeGreaterThanOrEqual(0);
});
