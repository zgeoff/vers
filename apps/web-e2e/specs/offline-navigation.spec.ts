import invariant from 'tiny-invariant';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

test('it moves between game screens and starts an activity offline, then delivers the start on reconnect', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // about 45 s on a local run: under software GL each click waits seconds on the live renderer
  test.setTimeout(90 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  // the world map caches a node's start inputs when it reveals the node, which needs the network
  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-play@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;

  // a start folds its build from the avatar's last run, so the player plays and ends one run
  // online first, as a returning player has; a fresh avatar's first start reads the server
  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();
  await page.getByRole('button', { name: 'END RUN' }).click();

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot === null ? null : [snapshot.liveRun, snapshot.outbox.activityStarts];
    })
    .toStrictEqual([null, []]);

  await page.getByRole('link', { exact: true, name: 'Respite' }).click();

  await expect(page).toHaveURL(/\/respite$/u);

  const failedAssets: Array<string> = [];

  page.on('requestfailed', (request) => {
    if (['font', 'script', 'stylesheet'].includes(request.resourceType())) {
      failedAssets.push(request.url());
    }
  });

  await page.context().setOffline(true);

  const outage = await createSharedWorkerOutage(browser);

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await expect(page).toHaveURL(/\/explore$/u);
  await expect(page.locator('canvas').first()).toBeVisible();

  await navigateClientRoute(page, '/explore/node/0_0');

  await expect(page.getByTestId('selected-node-id')).toHaveText('World Map Node (0_0)');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot?.liveRun;
    })
    .not.toBeNull();

  const offline = await readWorkerSnapshot(page);

  invariant(offline?.liveRun, 'the worker started the run with the network down');

  const activityID = offline.liveRun.activityID;

  await page.getByRole('link', { exact: true, name: 'Respite' }).click();

  await expect(page).toHaveURL(/\/respite$/u);
  await expect(page.getByRole('heading', { name: 'Respite' })).toBeVisible();

  const beforeReconnect = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

  await outage.end();
  await page.context().setOffline(false);

  // a flush that failed during the outage waits for the worker's next flush interval
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
  expect(offline.outbox.activityStarts).toStrictEqual([{ activityID }]);
  expect(beforeReconnect.status).toBe(404);
  expect(failedAssets).toStrictEqual([]);
});
