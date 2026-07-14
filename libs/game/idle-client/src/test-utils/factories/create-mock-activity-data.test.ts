import { expect, test } from 'bun:test';
import { ActivityDataSchema } from '@vers/contract-activity';
import { createMockActivityData } from './create-mock-activity-data';

test('it builds a contract-valid active activity by default', () => {
  const activity = createMockActivityData();

  expect(ActivityDataSchema.parse(activity)).toStrictEqual(activity);
  expect(activity.status).toBe('active');
});

test('it applies overrides over the defaults', () => {
  const activity = createMockActivityData({ appendedHead: 3, status: 'capped' });

  expect(activity.appendedHead).toBe(3);
  expect(activity.status).toBe('capped');
});
