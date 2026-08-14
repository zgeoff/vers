import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readAllStartRows } from './read-all-start-rows';
import { writeStartRow } from './write-start-row';

test('it reads every pending root across avatars', async () => {
  const first = createMockActivityData();
  const second = createMockActivityData();

  await writeStartRow(first);
  await writeStartRow(second);

  const rows = await readAllStartRows();

  expect(rows).toIncludeSameMembers([first, second]);
});

test('it reads nothing when no pending root is cached', async () => {
  const rows = await readAllStartRows();

  expect(rows).toStrictEqual([]);
});
