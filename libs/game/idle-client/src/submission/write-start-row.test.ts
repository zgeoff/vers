import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readStartRow } from './read-start-row';
import { writeStartRow } from './write-start-row';

test('it persists a row retrievable by its own id', async () => {
  const row = createMockActivityData();

  await writeStartRow(row);

  const stored = await readStartRow(row.id);

  expect(stored).toStrictEqual(row);
});

test('it overwrites an existing row with the same id', async () => {
  const row = createMockActivityData({ id: 'act_write_start_row' });
  const updated = createMockActivityData({ ...row, status: 'stopped' });

  await writeStartRow(row);
  await writeStartRow(updated);

  const stored = await readStartRow(row.id);

  expect(stored).toStrictEqual(updated);
});
