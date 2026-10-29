import { writeFile } from 'node:fs/promises';
import invariant from 'tiny-invariant';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

test('it saves a run started with the network down at a node whose last run the server refused', async ({
  browser,
  mockActivityURL,
  page,
}, testInfo) => {
  // under software GL each click waits seconds on the live renderer, and two offline runs each wait
  // for a delivery attempt
  test.setTimeout(150 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service refuses and admits starts');

  const email = 'e2e-offline-refusal@qa.versidle.com';
  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, email);

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

  const firstOutage = await createSharedWorkerOutage(browser);

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  // a checkpoint past the opening one moves the node's cached anchor past the run's start
  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return Math.max(
          0,
          ...(snapshot?.outbox.checkpoints ?? []).map((queued) => queued.highestVersion),
        );
      },
      { timeout: 30 * 1000 },
    )
    .toBeGreaterThanOrEqual(2);

  const settled = await fetch(
    `${mockActivityURL}/test/avatar-xp?${new URLSearchParams({ email, xp: '40' })}`,
    { method: 'POST' },
  );

  expect(settled.status).toBe(204);

  await firstOutage.end();
  await page.context().setOffline(false);

  // the server holds XP the run's start never folded, so it refuses that start for real
  await expect(page.getByRole('heading', { name: 'Run could not be saved' })).toBeVisible({
    timeout: 20 * 1000,
  });

  const restored = await fetch(
    `${mockActivityURL}/test/avatar-xp?${new URLSearchParams({ email, xp: '0' })}`,
    { method: 'POST' },
  );

  expect(restored.status).toBe(204);

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot === null ? null : [snapshot.liveRun, snapshot.outbox.activityStarts];
    })
    .toStrictEqual([null, []]);

  await page.context().setOffline(true);

  const secondOutage = await createSharedWorkerOutage(browser);

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

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

  await secondOutage.end();
  await page.context().setOffline(false);

  const refusal = page.getByRole('heading', { name: 'Run could not be saved' });

  // the delivery after reconnect ends in one of two answers: the service admits the start, or it
  // refuses it and the device shows the refusal
  await expect
    .poll(
      async () => {
        const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

        return response.status === 200 || (await refusal.count()) > 0;
      },
      { timeout: 20 * 1000 },
    )
    .toBe(true);

  // the worker's events name each start's chain index and each refusal, which a failure here needs
  const delivered = await page.evaluate(() => globalThis.__versQA?.snapshot());

  await writeFile(testInfo.outputPath('worker-snapshot.json'), JSON.stringify(delivered, null, 2));

  await expect(refusal).toHaveCount(0);

  const admitted = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

  expect(admitted.status).toBe(200);
  expect(firstOutage.workerCount).toBe(1);
  expect(secondOutage.workerCount).toBe(1);

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
});
