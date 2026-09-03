import type { Page } from '@playwright/test';
import { expect, test } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

const WRITER_LOCK_NAME = 'vers-idle-writer';

interface LockProbe {
  readonly heldClientIDs: ReadonlyArray<string>;
  readonly pendingCount: number;
}

// `navigator.locks.query()` from the page also reports locks held by the page's dedicated workers
function readWriterLock(page: Page, lockName: string): Promise<LockProbe> {
  return page.evaluate(async (name) => {
    const state = await navigator.locks.query();

    return {
      heldClientIDs: (state.held ?? [])
        .filter((lock) => lock.name === name)
        .map((lock) => lock.clientId ?? ''),
      pendingCount: (state.pending ?? []).filter((lock) => lock.name === name).length,
    };
  }, lockName);
}

test('it elects one writer without SharedWorker and promotes a survivor when the writer tab closes', async ({
  context,
  page,
}) => {
  // simulate Android Chrome: no SharedWorker in any page of this context, so the capability pick
  // takes the Web Locks path
  await context.addInitScript(() => {
    Reflect.deleteProperty(globalThis, 'SharedWorker');
  });

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an earlier
  // click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('e2e-web-locks@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  // the seeded account carries an avatar, so the active-avatar gate lands it in-game at respite
  await expect(page).toHaveURL(/\/respite$/);

  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  // the first tab's dedicated worker wins the election
  await expect
    .poll(async () => {
      const probe = await readWriterLock(page, WRITER_LOCK_NAME);

      return probe.heldClientIDs.length;
    })
    .toBe(1);

  const firstProbe = await readWriterLock(page, WRITER_LOCK_NAME);

  // one tab spawns exactly one election worker: a held lock with an empty queue
  expect(firstProbe.pendingCount).toBe(0);

  // a second tab in the same session spawns its own worker, which queues behind the writer
  const secondPage = await context.newPage();

  await secondPage.goto('/respite');

  await expect(secondPage).toHaveURL(/\/respite$/);

  // attached after the initial load settles, matching the other game specs: load-time noise (the
  // pre-existing data-URI font CSP reports) is not what this spec asserts on
  secondPage.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await expect
    .poll(async () => {
      const probe = await readWriterLock(secondPage, WRITER_LOCK_NAME);

      return probe.pendingCount;
    })
    .toBe(1);

  // still exactly one writer while both tabs live
  const bothOpenProbe = await readWriterLock(secondPage, WRITER_LOCK_NAME);

  expect(bothOpenProbe.heldClientIDs).toStrictEqual(firstProbe.heldClientIDs);

  // closing the writer tab kills its worker; the browser releases the lock and promotes the
  // survivor's worker as the new writer
  await page.close();

  await expect
    .poll(async () => {
      const probe = await readWriterLock(secondPage, WRITER_LOCK_NAME);

      return probe.heldClientIDs.length === 1 && probe.pendingCount === 0;
    })
    .toBe(true);

  const succeededProbe = await readWriterLock(secondPage, WRITER_LOCK_NAME);

  expect(succeededProbe.heldClientIDs).not.toStrictEqual(firstProbe.heldClientIDs);

  // the surviving tab keeps a working game shell on the new writer
  await secondPage.getByRole('link', { exact: true, name: 'Explore' }).click();

  await expect(secondPage).toHaveURL(/\/explore$/);

  expect(consoleErrors).toStrictEqual([]);
});
