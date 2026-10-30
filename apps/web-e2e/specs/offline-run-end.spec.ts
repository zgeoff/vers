import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import { createNetworkCut } from '../src/create-network-cut';
import { navigateClientRoute } from '../src/navigate-client-route';
import { readWorkerSnapshot } from '../src/read-worker-snapshot';
import { signIn } from '../src/sign-in';
import { expect, test } from '../src/test';

test('it keeps a run that ends with the network cut for the page and its workers', async ({
  browser,
  mockActivityURL,
  page,
}, testInfo) => {
  // under software GL each click waits seconds on the live renderer, and the run plays to its end
  test.setTimeout(180 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service holds the delivered run');

  await openWarmedMap(page, 'e2e-run-end-cut@qa.versidle.com');

  const cut = await createNetworkCut(browser, page.context());

  await markOutcomeRenders(page);
  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const activityID = await readLiveActivityID(page);

  await page.evaluate(() => globalThis.__versQA?.setSpeed(20));

  await expectRunEndUnderCut(page, activityID);

  const workerFetches = await cut.readWorkerFetches();

  await writeSnapshot(page, testInfo, 'run-end-snapshot.json');

  expect(workerFetches).toStrictEqual(['failed TypeError']);

  await expectNoRefusalShown(page);

  await cut.end();

  await expectServerHolds(mockActivityURL, activityID);
  await expectNoRefusalShown(page);
});

test('it keeps a run started online that ends after the network is cut', async ({
  browser,
  mockActivityURL,
  page,
}, testInfo) => {
  // under software GL each click waits seconds on the live renderer, and the run plays to its end
  test.setTimeout(180 * 1000);

  invariant(mockActivityURL !== undefined, 'the mock activity service holds the delivered run');

  await openWarmedMap(page, 'e2e-run-end-midcut@qa.versidle.com');
  await markOutcomeRenders(page);
  await navigateClientRoute(page, '/explore/node/0_0');

  await page.getByRole('link', { name: 'Click to start' }).click();

  await expect(page.getByRole('button', { name: 'END RUN' })).toBeVisible();

  const activityID = await readLiveActivityID(page);

  await expect
    .poll(async () => {
      const response = await fetch(`${mockActivityURL}/test/activity?id=${activityID}`);

      return response.status;
    })
    .toBe(200);

  const cut = await createNetworkCut(browser, page.context());

  await page.evaluate(() => globalThis.__versQA?.setSpeed(20));

  await expectRunEndUnderCut(page, activityID);

  const workerFetches = await cut.readWorkerFetches();

  await writeSnapshot(page, testInfo, 'run-end-snapshot.json');

  expect(workerFetches).toStrictEqual(['failed TypeError']);

  await expectNoRefusalShown(page);

  await cut.end();

  await expectServerHolds(mockActivityURL, activityID);
  await expectNoRefusalShown(page);
});

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
