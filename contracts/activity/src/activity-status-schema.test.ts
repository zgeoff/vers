import { expect, test } from 'bun:test';
import { ActivityStatusSchema } from './activity-status-schema';

test('it accepts every declared status value', () => {
  for (const status of ['active', 'stopped', 'rejected', 'capped', 'quarantined']) {
    expect(ActivityStatusSchema.safeParse(status).success).toBeTrue();
  }
});

test('it rejects a status outside the enum', () => {
  expect(ActivityStatusSchema.safeParse('paused').success).toBeFalse();
});
