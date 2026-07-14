import { expect, test } from 'bun:test';
import { OFFLINE_PROGRESS_CAP_MS } from './offline-progress-cap-ms';

test('it bounds offline progress to one day of simulated time', () => {
  expect(OFFLINE_PROGRESS_CAP_MS).toBe(86_400_000);
});
