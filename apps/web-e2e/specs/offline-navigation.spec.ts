import invariant from 'tiny-invariant';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

test('it moves between game screens and starts an activity offline, then delivers the start on reconnect', async ({
  mockActivityURL,
  page,
}) => {
  // about 30 s on a local run: under software GL each click waits seconds on the live renderer
  test.setTimeout(60 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  // the world map caches a node's start inputs when it reveals the node, which needs the network
  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-play@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;

  await page.getByRole('link', { exact: true, name: 'Respite' }).click();

  await expect(page).toHaveURL(/\/respite$/u);

  const failedAssets: Array<string> = [];

  page.on('requestfailed', (request) => {
    if (['font', 'script', 'stylesheet'].includes(request.resourceType())) {
      failedAssets.push(request.url());
    }
  });

  await page.context().setOffline(true);
  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await expect(page).toHaveURL(/\/explore$/u);
  await expect(page.locator('canvas').first()).toBeVisible();

  // a headless canvas gives no stable point to click a node at, so the spec takes the route a node
  // click takes
  await navigateClientRoute(page, '/explore/node/0_0');

  await expect(page.getByTestId('selected-node-id')).toHaveText('World Map Node (0_0)');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page).toHaveURL(/\/explore\/current$/u);

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

  await page.context().setOffline(false);

  await expect
    .poll(async () => {
      const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

      return response.status;
    })
    .toBe(200);

  expect(offline.outbox.activityStarts).toStrictEqual([{ activityID }]);
  expect(beforeReconnect.status).toBe(404);
  expect(failedAssets).toStrictEqual([]);
});
