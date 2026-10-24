import invariant from 'tiny-invariant';
import { createMockLiveRun } from '../src/create-mock-live-run';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';
import { waitForLiveRun } from '../src/wait-for-live-run';

test('it starts a fresh context on the live run after a takeover, the browser cell of the matrix row "it discards the outbox on a takeover from another device and mints from the server after the next sign-in"', async ({
  freshContext,
  mockActivityURL,
  page,
}) => {
  await signIn(page, 'e2e-device-takeover@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);

  const activityID = await createMockLiveRun(
    mockActivityURL,
    'e2e-device-takeover@qa.versidle.com',
  );

  await page.goto('/activity');

  const displaced = await waitForLiveRun(page, activityID);
  const freshPage = await freshContext.newPage();

  await signIn(freshPage, 'e2e-device-takeover@qa.versidle.com');

  // the account already holds a session, so the sign-in asks before it takes the account over
  await freshPage.getByRole('button', { name: 'Confirm' }).click();

  await expect(freshPage).toHaveURL(/\/respite$/u);

  await freshPage.goto('/activity');

  const fresh = await waitForLiveRun(freshPage, activityID);

  // a reconnect flushes the queued checkpoints at once instead of on the flush interval, and
  // Chromium fires no online event inside a SharedWorker, so the tab relays this one to the worker;
  // a flush of an empty outbox calls no server, so the reconnect repeats until one meets the takeover
  await expect(async () => {
    await page.context().setOffline(true);
    await page.context().setOffline(false);

    await expect(page.getByRole('dialog', { name: 'Playing on another device' })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot?.outbox;
    })
    .toStrictEqual({ activityStarts: [], checkpoints: [] });

  const afterTakeover = await readWorkerSnapshot(page);

  invariant(afterTakeover !== null, 'the displaced page kept its debug hook through the discard');

  expect(fresh.writer.workerID).not.toBe(displaced.writer.workerID);
  expect(fresh.outbox.activityStarts).toStrictEqual([]);
  expect(afterTakeover.liveRun).toBeNull();
  expect(afterTakeover.connectivityOnline).toBe(true);
  expect(afterTakeover.events).toContainEqual({ detail: 'discarding', type: 'lifecycle' });
  expect(afterTakeover.events).not.toContainEqual({ detail: 'offline', type: 'connectivity' });
});
