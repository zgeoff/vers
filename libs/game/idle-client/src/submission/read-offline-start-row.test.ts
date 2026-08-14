import { expect, test } from 'bun:test';
import { readOfflineStartRow } from './read-offline-start-row';

test('it returns undefined for an activity id this device holds no offline-start row for', async () => {
  const row = await readOfflineStartRow('act_read_offline_start_row_never_written');

  expect(row).toBeUndefined();
});
