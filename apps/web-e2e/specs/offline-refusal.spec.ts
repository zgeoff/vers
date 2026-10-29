import { writeFile } from 'node:fs/promises';
import invariant from 'tiny-invariant';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

test('it keeps the refusal on screen when the server refuses a run started with the network down', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // under software GL each click waits seconds on the live renderer
  test.setTimeout(90 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service refuses starts');

  const email = 'e2e-refusal-shown@qa.versidle.com';
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

  const outage = await createSharedWorkerOutage(browser);

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  // the server settles XP the device never saw, so it refuses the run's start for real
  const settled = await fetch(
    `${mockActivityURL}/test/avatar-xp?${new URLSearchParams({ email, xp: '40' })}`,
    { method: 'POST' },
  );

  expect(settled.status).toBe(204);

  await outage.end();
  await page.context().setOffline(false);

  const refusal = page.getByRole('heading', { name: 'Run could not be saved' });

  await expect(refusal).toBeVisible({ timeout: 20 * 1000 });

  // the worker resyncs once the drop is done, and the refusal stays until the player leaves it
  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot === null ? null : [snapshot.phase, snapshot.liveRun];
    })
    .toStrictEqual(['idle', null]);

  await expect(page).toHaveURL(/\/activity$/u);
  await expect(refusal).toBeVisible();

  expect(outage.workerCount).toBe(1);
});

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

  // the server settles XP the device never saw, so it refuses that run's start for real; the
  // resync after the refusal reads the new XP, and the next start folds it
  const settled = await fetch(
    `${mockActivityURL}/test/avatar-xp?${new URLSearchParams({ email, xp: '40' })}`,
    { method: 'POST' },
  );

  expect(settled.status).toBe(204);

  await firstOutage.end();
  await page.context().setOffline(false);

  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.events.some((event) => event.type === 'refusal');
      },
      { timeout: 20 * 1000 },
    )
    .toBe(true);

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot === null ? null : [snapshot.phase, snapshot.liveRun];
    })
    .toStrictEqual(['idle', null]);

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

  // the refusal can leave the screen as fast as it lands, so the page marks every render of it
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.body.textContent.includes('Run could not be saved')) {
        document.body.dataset['shownRefusal'] = 'true';
      }
    });

    observer.observe(document.body, { characterData: true, childList: true, subtree: true });
  });

  await secondOutage.end();
  await page.context().setOffline(false);

  // the delivery after reconnect ends in one of two answers: the service admits the start, or it
  // refuses it and the worker ends the run
  await expect
    .poll(
      async () => {
        const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
        const snapshot = await readWorkerSnapshot(page);

        const refused = snapshot?.events.some(
          (event) => event.type === 'run' && event.detail.startsWith(`${activityID} refused`),
        );

        return response.status === 200 || refused === true;
      },
      { timeout: 20 * 1000 },
    )
    .toBe(true);

  // the worker's events name each start's chain index and each refusal, which a failure here needs
  const delivered = await page.evaluate(() => globalThis.__versQA?.snapshot());

  await writeFile(testInfo.outputPath('worker-snapshot.json'), JSON.stringify(delivered, null, 2));

  const shownRefusal = await page.locator('body').getAttribute('data-shown-refusal');

  expect(shownRefusal, 'the page showed "Run could not be saved"').toBeNull();

  const admitted = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

  expect(admitted.status).toBe(200);
  expect(firstOutage.workerCount).toBe(1);
  expect(secondOutage.workerCount).toBe(1);

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
});

test('it saves a run started with only the page offline at a node whose last run the server refused', async ({
  browser,
  mockActivityURL,
  page,
}, testInfo) => {
  // under software GL each click waits seconds on the live renderer, and the refused run waits for
  // a delivery attempt
  test.setTimeout(150 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service refuses and admits starts');

  const email = 'e2e-refusal-page@qa.versidle.com';
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

  const outage = await createSharedWorkerOutage(browser);

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

  // the server settles XP the device never saw, so it refuses that run's start for real; the
  // resync after the refusal reads the new XP, and the next start folds it
  const settled = await fetch(
    `${mockActivityURL}/test/avatar-xp?${new URLSearchParams({ email, xp: '40' })}`,
    { method: 'POST' },
  );

  expect(settled.status).toBe(204);

  await outage.end();
  await page.context().setOffline(false);

  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.events.some((event) => event.type === 'refusal');
      },
      { timeout: 20 * 1000 },
    )
    .toBe(true);

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot === null ? null : [snapshot.phase, snapshot.liveRun];
    })
    .toStrictEqual(['idle', null]);

  // the browser's offline switch covers the page and never its SharedWorker, as a DevTools network
  // toggle does: every request the page makes fails, and the worker still reaches the server
  await page.context().setOffline(true);

  const pageActivityRequests: Array<string> = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/rpc/activity/')) {
      pageActivityRequests.push(request.url());
    }
  });

  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.body.textContent.includes('Run could not be saved')) {
        document.body.dataset['shownRefusal'] = 'true';
      }
    });

    observer.observe(document.body, { characterData: true, childList: true, subtree: true });
  });

  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the run with only the page offline');

  const activityID = started.liveRun.activityID;

  await expect
    .poll(
      async () => {
        const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
        const snapshot = await readWorkerSnapshot(page);

        const refused = snapshot?.events.some(
          (event) => event.type === 'run' && event.detail.startsWith(`${activityID} refused`),
        );

        return response.status === 200 || refused === true;
      },
      { timeout: 20 * 1000 },
    )
    .toBe(true);

  // the worker's events name each start's chain index and each refusal, which a failure here needs
  const delivered = await page.evaluate(() => globalThis.__versQA?.snapshot());

  await writeFile(testInfo.outputPath('worker-snapshot.json'), JSON.stringify(delivered, null, 2));

  expect(pageActivityRequests).toStrictEqual([]);

  const shownRefusal = await page.locator('body').getAttribute('data-shown-refusal');

  expect(shownRefusal, 'the page showed "Run could not be saved"').toBeNull();

  const admitted = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

  expect(admitted.status).toBe(200);
  expect(outage.workerCount).toBe(1);

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();
});
