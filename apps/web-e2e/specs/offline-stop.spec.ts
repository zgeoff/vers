import invariant from 'tiny-invariant';
import * as z from 'zod';
import { createSharedWorkerOutage } from '../src/create-shared-worker-outage';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

const ActivityStatusSchema = z.object({ appendedHead: z.int(), status: z.string() });
const TargetInfoSchema = z.object({ type: z.string() });
const TargetsSchema = z.object({ targetInfos: z.array(TargetInfoSchema) });

test('it saves what a run earned with the network down before the player ended it, through a reopen', async ({
  browser,
  mockActivityURL,
  page,
}) => {
  // under software GL each click waits seconds on the live renderer, and this journey reopens the game
  test.setTimeout(90 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service reports admitted starts');

  const revealed = page.waitForResponse(/\/revealNodes/u);

  await signIn(page, 'e2e-offline-stop@qa.versidle.com');

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => readWorkerSnapshot(page)).not.toBeNull();

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await revealed;
  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const live = await readWorkerSnapshot(page);

  invariant(live?.liveRun, 'the worker started the run online');

  const activityID = live.liveRun.activityID;

  await expect
    .poll(async () => {
      const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

      return response.status;
    })
    .toBe(200);

  await page.context().setOffline(true);

  const outage = await createSharedWorkerOutage(browser);

  // the run plays on with the network down until a checkpoint it earned fails to send
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

  await page.getByRole('button', { name: 'END RUN' }).click();

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot?.liveRun;
    })
    .toBeNull();

  const beforeReopen = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
  const beforeReopenBody: unknown = await beforeReopen.json();

  const heldBeforeReopen = ActivityStatusSchema.parse(beforeReopenBody);

  // Chrome keeps a shared worker alive across a reload, so the game is closed instead: with its
  // only page gone the worker that held the stop's checkpoints in memory ends, and the one that
  // boots online finds them only in the outbox
  const context = page.context();

  const targets = await browser.newBrowserCDPSession();

  await page.close();

  await expect
    .poll(async () => {
      const reply: unknown = await targets.send('Target.getTargets');

      const listed = TargetsSchema.parse(reply);

      return listed.targetInfos.filter((target) => target.type === 'shared_worker').length;
    })
    .toBe(0);

  // the outage's DevTools session outlives the worker it cut, and the next worker boots stalled
  // until that session ends
  await targets.detach();
  await outage.end();
  await context.setOffline(false);

  const reopened = await context.newPage();

  await reopened.goto('/explore');

  await expect
    .poll(
      async () => {
        const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
        const body: unknown = await response.json();

        return ActivityStatusSchema.parse(body).status;
      },
      { timeout: 20 * 1000 },
    )
    .toBe('stopped');

  const afterReopen = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);
  const afterReopenBody: unknown = await afterReopen.json();

  const heldAfterReopen = ActivityStatusSchema.parse(afterReopenBody);

  expect(outage.workerCount).toBe(1);
  expect(heldBeforeReopen.status).toBe('active');
  expect(heldAfterReopen.appendedHead).toBeGreaterThan(heldBeforeReopen.appendedHead);

  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(reopened);

      return snapshot?.outbox.checkpoints;
    })
    .toStrictEqual([]);

  await expect(reopened.getByRole('heading', { name: 'Run could not be saved' })).toHaveCount(0);
});
