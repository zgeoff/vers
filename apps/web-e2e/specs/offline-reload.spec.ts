import invariant from 'tiny-invariant';
import * as z from 'zod';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

const ActivityStatusSchema = z.object({ appendedHead: z.int(), status: z.string() });

test('it keeps a run started with the network down as started, with its progress, through a reconnect and a reload', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // under software GL each click waits seconds on the live renderer, and this journey adds a reload
  test.setTimeout(90 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-reload@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;

  // a returning player has played the node before: a run ended right after it began leaves the
  // node's chain where it was, since its only checkpoint draws nothing from the seed
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

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the run with the network down');

  const activityID = started.liveRun.activityID;

  // the run plays offline until its first checkpoint flush fails on the dead network
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

  await page.reload();

  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.liveRun?.activityID;
      },
      { timeout: 20 * 1000 },
    )
    .toBe(activityID);

  const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
  const body: unknown = await response.json();

  const held = ActivityStatusSchema.parse(body);

  expect(outage.workerCount).toBe(1);
  expect(held.status).toBe('active');
  expect(held.appendedHead).toBeGreaterThan(0);

  await expect(page).toHaveURL(/\/activity$/u);
  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
  await expect(page.getByTestId('run-outcome-panel')).toHaveCount(0);
});

test('it keeps a run started with the network down after ending a run that played offline, through a reconnect and a reload', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // under software GL each click waits seconds on the live renderer, and this journey adds a reload
  test.setTimeout(90 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-switch@qa.versidle.com');

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

  // the first run is still playing when the network drops, and it earns past what the server holds
  await page.context().setOffline(true);

  const outage = await createSharedWorkerOutage(browser);

  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.outbox.checkpoints.find((queued) => queued.activityID === firstActivityID)
          ?.lastFlush?.type;
      },
      { timeout: 20 * 1000 },
    )
    .toBe('transport-failure');

  await page.getByRole('button', { name: 'END RUN' }).click();

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      const liveActivityID = snapshot?.liveRun?.activityID;

      return liveActivityID === firstActivityID ? undefined : liveActivityID;
    })
    .toMatch(/^act_/u);

  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the second run with the network down');

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
  await page.reload();

  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.liveRun?.activityID;
      },
      { timeout: 20 * 1000 },
    )
    .toBe(activityID);

  const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
  const body: unknown = await response.json();

  const held = ActivityStatusSchema.parse(body);

  expect(outage.workerCount).toBe(1);
  expect(held.status).toBe('active');
  expect(held.appendedHead).toBeGreaterThan(0);

  await expect(page).toHaveURL(/\/activity$/u);
  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
  await expect(page.getByTestId('run-outcome-panel')).toHaveCount(0);
});
