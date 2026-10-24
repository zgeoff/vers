import { z } from 'zod';
import { expect, test } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

test.skip(({ codeSource }) => codeSource === 'mock', 'the mock-mode build has no tracker tag');

test('it loads the tracker once and records one pageview per client navigation', async ({
  page,
}) => {
  const trackerRequests: Array<string> = [];
  const pageviewPaths: Array<string> = [];

  // routing the requests bypasses the memory cache, so a re-appended tracker tag counts even when
  // the browser could reuse the cached script
  await page.route('**/site.js', async (route) => {
    trackerRequests.push(route.request().url());

    await route.continue();
  });

  page.on('request', (request) => {
    if (new URL(request.url()).pathname !== '/site/api/send') {
      return;
    }

    // a pageview is the tracker's one event that carries no name
    const pageview = z
      .object({
        payload: z.object({ name: z.undefined().optional(), url: z.string() }),
        type: z.literal('event'),
      })
      .safeParse(request.postDataJSON());

    if (pageview.success) {
      pageviewPaths.push(new URL(pageview.data.payload.url).pathname);
    }
  });

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an earlier
  // click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('e2e-analytics@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/respite$/u);
  await expect.poll(() => pageviewPaths).toStrictEqual(['/login', '/respite']);

  const expectedPaths = ['/login', '/respite'];

  for (const [linkName, path] of [
    ['Stash', '/stash'],
    ['Market', '/market'],
    ['Avatar', '/avatar'],
    ['Explore', '/explore'],
    ['Respite', '/respite'],
  ] as const) {
    await page.getByRole('link', { exact: true, name: linkName }).click();

    await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));

    expectedPaths.push(path);

    await expect.poll(() => pageviewPaths).toStrictEqual(expectedPaths);
  }

  expect(trackerRequests).toHaveLength(1);
});
