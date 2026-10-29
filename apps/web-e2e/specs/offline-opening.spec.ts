import invariant from 'tiny-invariant';
import * as z from 'zod';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

const ActivityRowsSchema = z.array(z.object({ appendedHead: z.int(), status: z.string() }));
const ActivityStatusSchema = z.object({ appendedHead: z.int(), status: z.string() });

test('it saves a run started with the network down at a node whose last run ended on its opening checkpoint', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // under software GL each click waits seconds on the live renderer, and the opening run may need
  // a few tries to end before its first fight
  test.setTimeout(120 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-opening@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;

  let openingOnly = false;

  // a run whose only checkpoint is its opening one leaves the server's chain where it was; the run
  // is ended the moment its END RUN button renders, and tried again if a fight landed first
  for (let attempt = 0; attempt < 8 && !openingOnly; attempt += 1) {
    await navigateClientRoute(page, '/explore/node/0_0');

    await page.getByRole('link', { name: 'Click to start' }).click();

    await page.waitForFunction(
      () => {
        const button = [...document.querySelectorAll('button')].find(
          (candidate) => candidate.textContent === 'END RUN',
        );

        button?.click();

        return button !== undefined;
      },
      null,
      { polling: 5 },
    );

    await expect
      .poll(async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot === null ? null : [snapshot.liveRun, snapshot.outbox.activityStarts];
      })
      .toStrictEqual([null, []]);

    const listed = await fetch(`${mockActivityURL}/test/activities`);
    const listedBody: unknown = await listed.json();

    const rows = ActivityRowsSchema.parse(listedBody);

    openingOnly = rows.at(-1)?.appendedHead === 1;
  }

  invariant(openingOnly, 'a run ended on its opening checkpoint');

  await page.context().setOffline(true);

  const outage = await createSharedWorkerOutage(browser);

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the run with the network down');

  const activityID = started.liveRun.activityID;

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

  const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
  const body: unknown = await response.json();

  const held = ActivityStatusSchema.parse(body);

  expect(outage.workerCount).toBe(1);
  expect(held.status).toBe('active');

  await expect(page.getByRole('heading', { name: 'Run could not be saved' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
});
