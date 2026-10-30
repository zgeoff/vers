import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import { createNetworkCut } from '../src/create-network-cut';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

interface RunEndJourney {
  readonly cutAt: 'before-start' | 'mid-run';
  readonly email: string;
  readonly title: string;
  readonly transport: 'shared-worker' | 'web-locks';
}

const JOURNEYS: ReadonlyArray<RunEndJourney> = [
  {
    cutAt: 'before-start',
    email: 'e2e-run-end-shared-cut@qa.versidle.com',
    title: 'it keeps a run that ends with the network cut for the page and its shared worker',
    transport: 'shared-worker',
  },
  {
    cutAt: 'mid-run',
    email: 'e2e-run-end-shared-midcut@qa.versidle.com',
    title: 'it keeps a run started online that ends after the network is cut',
    transport: 'shared-worker',
  },
  {
    cutAt: 'before-start',
    email: 'e2e-run-end-locks-cut@qa.versidle.com',
    title: 'it keeps a run that ends with the network cut where no SharedWorker exists',
    transport: 'web-locks',
  },
  {
    cutAt: 'mid-run',
    email: 'e2e-run-end-locks-midcut@qa.versidle.com',
    title: 'it keeps a run started online that ends after the cut where no SharedWorker exists',
    transport: 'web-locks',
  },
];

for (const journey of JOURNEYS) {
  test(journey.title, async ({ browser, mockActivityURL, page }, testInfo) => {
    // under software GL each click waits seconds on the live renderer, and the run plays to its end
    test.setTimeout(180 * 1000);

    invariant(mockActivityURL !== undefined, 'the mock activity service holds the delivered run');

    // Android Chrome has no SharedWorker, so the tabs elect a dedicated worker through Web Locks
    if (journey.transport === 'web-locks') {
      await page.context().addInitScript(() => {
        Reflect.deleteProperty(globalThis, 'SharedWorker');
      });
    }

    await openWarmedMap(page, journey.email);
    await markOutcomeRenders(page);

    let cut =
      journey.cutAt === 'before-start' ? await createNetworkCut(browser, page.context()) : null;

    await navigateClientRoute(page, '/explore/node/0_0');

    await page.getByRole('link', { name: 'Click to start' }).click();

    await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

    const activityID = await readLiveActivityID(page);

    if (journey.cutAt === 'mid-run') {
      await expect
        .poll(async () => {
          const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

          return response.status;
        })
        .toBe(200);
    }

    cut ??= await createNetworkCut(browser, page.context());

    const cutAt = Date.now();

    await page.evaluate(() => globalThis.__versQA?.setSpeed(20));

    await expectRunEndUnderCut(page, activityID);

    const workerFetches = await cut.readWorkerFetches();
    const ended = await readWorkerSnapshot(page);

    await writeSnapshot(page, testInfo, 'run-end-snapshot.json');

    const expectedWorkerFetches = journey.transport === 'shared-worker' ? ['failed TypeError'] : [];

    expect(workerFetches).toStrictEqual(expectedWorkerFetches);

    // every request the worker sent during the cut failed in transport, and none was answered
    const exchanges = (ended?.events ?? [])
      .filter((event) => event.type === 'rpc' && event.at >= cutAt)
      .map((event) => event.detail.split(' ')[1]);

    expect(exchanges).toContain('unanswered');
    expect(exchanges).not.toContain('answered');

    await expectNoRefusalShown(page);

    await cut.end();

    await expectServerHolds(mockActivityURL, activityID);

    // the outbox drains every start and checkpoint the device made during the cut, the next run's
    // start included
    await expect
      .poll(
        async () => {
          const snapshot = await readWorkerSnapshot(page);

          return snapshot === null
            ? null
            : [snapshot.outbox.activityStarts.length, snapshot.outbox.checkpoints.length];
        },
        { timeout: 30 * 1000 },
      )
      .toStrictEqual([0, 0]);

    await writeSnapshot(page, testInfo, 'reconnect-snapshot.json');
    await expectNoRefusalShown(page);
  });
}

async function openWarmedMap(page: Page, email: string): Promise<void> {
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
}

// an outcome can leave the screen as fast as it lands, when the next run of the node goes live, so
// the page marks every render of each one
async function markOutcomeRenders(page: Page): Promise<void> {
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const text = document.body.textContent;

      if (text.includes('Run could not be saved')) {
        document.body.dataset['shownRefusal'] = 'true';
      }

      if (text.includes('Encounter cleared') || text.includes('Your avatar fell')) {
        document.body.dataset['shownOutcome'] = 'true';
      }
    });

    observer.observe(document.body, { characterData: true, childList: true, subtree: true });
  });
}

async function readLiveActivityID(page: Page): Promise<string> {
  const started = await readWorkerSnapshot(page);

  invariant(started?.liveRun, 'the worker started the run');

  return started.liveRun.activityID;
}

async function expectRunEndUnderCut(page: Page, activityID: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const snapshot = await readWorkerSnapshot(page);

        return snapshot?.events.find(
          (event) => event.type === 'run' && event.detail.startsWith(`${activityID} `),
        )?.detail;
      },
      { intervals: [500], timeout: 120 * 1000 },
    )
    .toMatch(/ (?:completed|failed) /u);

  // the worker's first delivery attempts after the run's end land within its retry window
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

  await expect(page.locator('body')).toHaveAttribute('data-shown-outcome', 'true');
}

async function writeSnapshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const snapshot = await page.evaluate(() => globalThis.__versQA?.snapshot());

  await writeFile(testInfo.outputPath(name), JSON.stringify(snapshot, null, 2));

  await testInfo.attach(name, { contentType: 'application/json', path: testInfo.outputPath(name) });
}

async function expectNoRefusalShown(page: Page): Promise<void> {
  const shownRefusal = await page.locator('body').getAttribute('data-shown-refusal');

  expect(shownRefusal, 'the page showed "Run could not be saved"').toBeNull();
}

const ActivityStatusSchema = z.object({ appendedHead: z.int(), status: z.string() });

async function expectServerHolds(mockActivityURL: string, activityID: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

        if (response.status !== 200) {
          return response.status;
        }

        const body: unknown = await response.json();

        return ActivityStatusSchema.parse(body);
      },
      { timeout: 30 * 1000 },
    )
    .toMatchObject({ status: 'stopped' });
}
