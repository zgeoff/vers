import { expect, test } from 'bun:test';
import { buildSegmentDuration } from './build-segment-duration';

test('it sizes the cap from appendedTimeMs plus a proportional margin and a per-checkpoint timestep', () => {
  expect(buildSegmentDuration(10_000, 4)).toBe(Math.ceil(10_000 * 1.1) + 50 * 4);
});

test('it reports only the per-checkpoint margin for a zero-time activity', () => {
  expect(buildSegmentDuration(0, 1)).toBe(50);
});
