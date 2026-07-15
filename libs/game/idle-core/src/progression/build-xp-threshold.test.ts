import { expect, test } from 'bun:test';
import { buildXPThreshold } from './build-xp-threshold';

test('it returns zero xp for level one', () => {
  expect(buildXPThreshold(1)).toBe(0);
});

test('it strictly increases as level increases', () => {
  const thresholds = Array.from({ length: 30 }, (_, index) => buildXPThreshold(index + 1));

  for (let index = 1; index < thresholds.length; index++) {
    expect(thresholds[index]).toBeGreaterThan(thresholds[index - 1]!);
  }
});
