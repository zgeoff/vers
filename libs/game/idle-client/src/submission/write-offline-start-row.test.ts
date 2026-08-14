import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readOfflineStartRow } from './read-offline-start-row';
import { writeOfflineStartRow } from './write-offline-start-row';

test('it persists a row retrievable by its own id', async () => {
  const row = createMockActivityData();

  await writeOfflineStartRow(row);

  const stored = await readOfflineStartRow(row.id);

  expect(stored).toStrictEqual(row);
});

test('it overwrites an existing row with the same id', async () => {
  const row = createMockActivityData({ id: 'act_write_offline_start_row' });
  const updated = createMockActivityData({ ...row, status: 'stopped' });

  await writeOfflineStartRow(row);
  await writeOfflineStartRow(updated);

  const stored = await readOfflineStartRow(row.id);

  expect(stored).toStrictEqual(updated);
});
