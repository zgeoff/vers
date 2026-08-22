import { expect, test } from 'bun:test';
import { readActivityStart } from './read-activity-start';

test('it returns undefined for an activity id this device holds no pending activityStart for', async () => {
  const row = await readActivityStart('act_read_start_row_never_written');

  expect(row).toBeUndefined();
});
