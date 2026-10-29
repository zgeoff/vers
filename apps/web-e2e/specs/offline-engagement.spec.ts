import invariant from 'tiny-invariant';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

test('it keeps a run started offline on the Engagement panel through a failed delivery, then delivers it on reconnect', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // about 95 s on a local run: under software GL each click waits seconds on the live renderer
  test.setTimeout(120 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  // the world map caches a node's start inputs when it reveals the node, which needs the network
  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-engage@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;

  // a start folds its build from the avatar's last run, so the player plays and ends one run
  // online first, as a returning player has
  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();
  await page.getByRole('button', { name: 'END RUN' }).click();

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot === null ? null : [snapshot.liveRun, snapshot.outbox.activityStarts];
    })
    .toStrictEqual([null, []]);

  await page.context().setOffline(true);

  const outage = await createSharedWorkerOutage(browser);

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page).toHaveURL(/\/activity$/u);
  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the run with the network down');

  const activityID = started.liveRun.activityID;

  // the worker tries the run's first checkpoint, and with it the start, on its flush interval
  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.outbox.checkpoints.find((queued) => queued.activityID === activityID)
          ?.lastFlush?.type;
      },
      { timeout: 20 * 1000 },
    )
    .toBe('transport-failure');

  const failed = await readWorkerSnapshot(page);
  const refusalShownOffline = await page.getByTestId('run-outcome-panel').count();
  const beforeReconnect = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

  await outage.end();
  await page.context().setOffline(false);

  await expect
    .poll(
      async () => {
        const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

        return response.status;
      },
      { timeout: 20 * 1000 },
    )
    .toBe(200);

  expect(outage.workerCount).toBe(1);
  expect(refusalShownOffline).toBe(0);
  expect(failed?.liveRun?.activityID).toBe(activityID);
  expect(failed?.outbox.activityStarts).toStrictEqual([{ activityID }]);
  expect(beforeReconnect.status).toBe(404);

  await expect(page.getByTestId('run-outcome-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
});

test('it delivers a run started on the Engagement panel while only the page is offline, and the worker still reaches the server', async ({
  mockActivityURL,
  page,
}) => {
  // about 80 s on a local run: under software GL each click waits seconds on the live renderer
  test.setTimeout(120 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-worker-online@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;
  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();
  await page.getByRole('button', { name: 'END RUN' }).click();

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot === null ? null : [snapshot.liveRun, snapshot.outbox.activityStarts];
    })
    .toStrictEqual([null, []]);

  // the browser's offline switch covers the page and never its SharedWorker, as a player's
  // DevTools toggle does, so the worker keeps the network the page lost
  await page.context().setOffline(true);

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page).toHaveURL(/\/activity$/u);
  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the run with the page offline');

  const activityID = started.liveRun.activityID;

  await expect
    .poll(
      async () => {
        const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

        return response.status;
      },
      { timeout: 20 * 1000 },
    )
    .toBe(200);

  const delivered = await readWorkerSnapshot(page);
  const refusalShownOffline = await page.getByTestId('run-outcome-panel').count();

  await page.context().setOffline(false);

  const afterReconnect = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

  expect(refusalShownOffline).toBe(0);
  expect(delivered?.liveRun?.activityID).toBe(activityID);
  expect(afterReconnect.status).toBe(200);

  await expect(page.getByTestId('run-outcome-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
});
