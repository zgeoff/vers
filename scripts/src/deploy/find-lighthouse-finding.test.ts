import { expect, test } from 'bun:test';
import { findLighthouseFinding } from './find-lighthouse-finding';

test('it reports no finding when the performance score meets the minimum', () => {
  expect(
    findLighthouseFinding(
      { kind: 'lighthouse', minPerformanceScore: 0.5, url: 'https://example.test/' },
      { performance: 0.5 },
    ),
  ).toBeNull();
});

test('it reports the score and the minimum when the page falls under it', () => {
  expect(
    findLighthouseFinding(
      { kind: 'lighthouse', minPerformanceScore: 0.5, url: 'https://example.test/' },
      { performance: 0.42 },
    ),
  ).toBe('performance score 0.42 is under the 0.50 minimum');
});

test('it reports a missing score as a finding rather than a pass', () => {
  expect(
    findLighthouseFinding(
      { kind: 'lighthouse', minPerformanceScore: 0.5, url: 'https://example.test/' },
      { performance: null },
    ),
  ).toBe('lighthouse produced no performance score');
});
