import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readActivityStart } from './read-activity-start';
import { removeActivityStart } from './remove-activity-start';
import { writeActivityStart } from './write-activity-start';

test('it removes a previously written row', async () => {
  const row = createMockActivityData({ id: 'act_remove_start_row' });

  await writeActivityStart(row);
  await removeActivityStart(row.id);

  const stored = await readActivityStart(row.id);

  expect(stored).toBeUndefined();
});

test('it tolerates removing an activity id this device holds no row for', async () => {
  await expect(removeActivityStart('act_remove_start_row_absent')).toResolve();
});
