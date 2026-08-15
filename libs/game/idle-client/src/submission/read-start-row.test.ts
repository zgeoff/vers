import { expect, test } from 'bun:test';
import { readStartRow } from './read-start-row';

test('it returns undefined for an activity id this device holds no pending root for', async () => {
  const row = await readStartRow('act_read_start_row_never_written');

  expect(row).toBeUndefined();
});
