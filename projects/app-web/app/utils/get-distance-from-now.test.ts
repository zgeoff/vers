import { expect, test, vi } from 'vitest';
import { getDistanceFromNow } from './get-distance-from-now';

test('it returns the correct distance for a past date', () => {
  // Mock current date to ensure consistent test results
  const now = new Date('2024-02-13T12:00:00Z');

  vi.setSystemTime(now);

  const pastDate = new Date('2024-02-13T11:59:00Z');

  const result = getDistanceFromNow(pastDate);

  expect(result).toBe('1 minute ago');

  vi.useRealTimers();
});

test('it returns the correct distance for a future date', () => {
  const now = new Date('2024-02-13T12:00:00Z');

  vi.setSystemTime(now);

  const futureDate = new Date('2024-02-13T12:01:00Z');

  const result = getDistanceFromNow(futureDate);

  expect(result).toBe('in 1 minute');

  vi.useRealTimers();
});

test('it handles dates with seconds precision', () => {
  const now = new Date('2024-02-13T12:00:00Z');

  vi.setSystemTime(now);

  const pastDate = new Date('2024-02-13T11:59:45Z');

  const result = getDistanceFromNow(pastDate);

  expect(result).toBe('less than 20 seconds ago');

  vi.useRealTimers();
});
