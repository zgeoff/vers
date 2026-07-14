import { expect, test } from 'bun:test';
import { ActivityStatusSchema } from './activity-status-schema';

test('it accepts every declared status value', () => {
  for (const status of ['active', 'stopped', 'rejected', 'capped', 'quarantined', 'parked']) {
    expect(ActivityStatusSchema.safeParse(status).success).toBeTrue();
  }
});

test('it rejects a status outside the enum', () => {
  const result = ActivityStatusSchema.safeParse('paused');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
