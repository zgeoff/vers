import invariant from 'tiny-invariant';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

test('it saves a run started with the network down while another run was still earning', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // under software GL each click waits seconds on the live renderer
  test.setTimeout(90 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-build@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;
  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const live = await readWorkerSnapshot(page);

  invariant(live?.liveRun, 'the worker started the first run online');

  const firstActivityID = live.liveRun.activityID;

  await expect
    .poll(async () => {
      const response = await fetch(`${mockActivityURL}/test/activity?id=${firstActivityID}`);

      return response.status;
    })
    .toBe(200);

  await page.context().setOffline(true);

  const outage = await createSharedWorkerOutage(browser);

  // the mint reads its predecessor from this store after it reads the build, so a write the page
  // holds open on it widens the window between that read and the first run's halt to seconds, in
  // which the first run earns several checkpoints
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const opened = indexedDB.open('vers-idle-checkpoint-queue');

        opened.addEventListener('error', () => {
          reject(new Error('the outbox database did not open'));
        });

        opened.addEventListener('success', () => {
          const database = opened.result;
          const transaction = database.transaction('pending-activity-starts', 'readwrite');
          const store = transaction.objectStore('pending-activity-starts');
          const heldUntil = Date.now() + 8000;

          const holdOpen = () => {
            if (Date.now() < heldUntil) {
              store.count().addEventListener('success', holdOpen);
            }
          };

          holdOpen();

          transaction.addEventListener('complete', () => {
            database.close();
          });

          resolve();
        });
      }),
  );

  await navigateClientRoute(page, '/explore/node/1_0');

  await expect(page.getByTestId('selected-node-id')).toHaveText('World Map Node (1_0)');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.liveRun?.scopeID;
      },
      { timeout: 20 * 1000 },
    )
    .toBe('1_0');

  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the second run with the network down');

  const activityID = started.liveRun.activityID;

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

  await expect(page.getByRole('heading', { name: 'Run could not be saved' })).toHaveCount(0);
});
