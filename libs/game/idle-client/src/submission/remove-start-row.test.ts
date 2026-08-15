import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readStartRow } from './read-start-row';
import { removeStartRow } from './remove-start-row';
import { writeStartRow } from './write-start-row';

test('it removes a previously written row', async () => {
  const row = createMockActivityData({ id: 'act_remove_start_row' });

  await writeStartRow(row);
  await removeStartRow(row.id);

  const stored = await readStartRow(row.id);

  expect(stored).toBeUndefined();
});

test('it tolerates removing an activity id this device holds no row for', async () => {
  await expect(removeStartRow('act_remove_start_row_absent')).toResolve();
});
