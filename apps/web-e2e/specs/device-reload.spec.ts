import { createMockLiveRun } from '../src/create-mock-live-run';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';
import { waitForLiveRun } from '../src/wait-for-live-run';

test('it reattaches the live run after a page reload, the browser cell of the matrix row "it delivers the start on a reload with an undelivered start and reattaches its run"', async ({
  mockActivityURL,
  page,
}) => {
  await signIn(page, 'e2e-device-reload@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);

  const activityID = await createMockLiveRun(mockActivityURL, 'e2e-device-reload@qa.versidle.com');

  await page.goto('/activity');

  const beforeReload = await waitForLiveRun(page, activityID);

  await page.reload();

  const afterReload = await waitForLiveRun(page, activityID);

  expect(afterReload.tab.tabID).not.toBe(beforeReload.tab.tabID);
  expect(afterReload.phase).toBe('running');
  expect(afterReload.outbox.activityStarts).toStrictEqual([]);

  await expect(page.getByText('World Map Encounter')).toBeVisible();
});
