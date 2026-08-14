import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readAllOfflineStartRows } from './read-all-offline-start-rows';
import { writeOfflineStartRow } from './write-offline-start-row';

test('it reads every offline-start row across avatars', async () => {
  const first = createMockActivityData();
  const second = createMockActivityData();

  await writeOfflineStartRow(first);
  await writeOfflineStartRow(second);

  const rows = await readAllOfflineStartRows();

  expect(rows).toIncludeSameMembers([first, second]);
});

test('it reads nothing when no offline-start row is cached', async () => {
  const rows = await readAllOfflineStartRows();

  expect(rows).toStrictEqual([]);
});
