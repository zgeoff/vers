import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readActivityStart } from './read-activity-start';
import { writeActivityStart } from './write-activity-start';

test('it persists a row retrievable by its own id', async () => {
  const row = createMockActivityData();

  await writeActivityStart(row);

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it overwrites an existing row with the same id', async () => {
  const row = createMockActivityData({ id: 'act_write_start_row' });
  const updated = createMockActivityData({ ...row, status: 'stopped' });

  await writeActivityStart(row);
  await writeActivityStart(updated);

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(updated);
});
