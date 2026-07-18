import { expect, test } from 'bun:test';
import { ActivityFailureActionSchema } from './activity-failure-action-schema';

test('it accepts every declared failure-action value', () => {
  for (const failureAction of ['abort', 'retry']) {
    expect(ActivityFailureActionSchema.safeParse(failureAction).success).toBeTrue();
  }
});

test('it rejects a failure action outside the enum', () => {
  const result = ActivityFailureActionSchema.safeParse('ignore');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
