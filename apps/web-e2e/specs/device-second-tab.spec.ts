import { createMockLiveRun } from '../src/create-mock-live-run';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';
import { waitForLiveRun } from '../src/wait-for-live-run';

test(`it joins a second tab to the writer's live run, the browser cell of the matrix row "it attaches a second tab's start to the writer's live run without a mint"`, async ({
  context,
  mockActivityURL,
  page,
}) => {
  await signIn(page, 'e2e-device-tab@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);

  const activityID = await createMockLiveRun(mockActivityURL, 'e2e-device-tab@qa.versidle.com');

  await page.goto('/activity');

  const firstTab = await waitForLiveRun(page, activityID);
  const secondPage = await context.newPage();

  await secondPage.goto('/activity');

  const secondTab = await waitForLiveRun(secondPage, activityID);

  expect(secondTab.writer).toStrictEqual(firstTab.writer);
  expect(secondTab.tab.tabID).not.toBe(firstTab.tab.tabID);
  expect(secondTab.outbox.activityStarts).toStrictEqual([]);

  await expect(secondPage.getByText('World Map Encounter')).toBeVisible();
});
