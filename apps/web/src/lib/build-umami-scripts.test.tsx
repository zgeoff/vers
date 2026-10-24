import { expect, test } from 'bun:test';
import {
  HeadContent,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import invariant from 'tiny-invariant';
import { buildUmamiScripts } from './build-umami-scripts';

test('it builds a deferred tracker tag riding the same-origin proxy paths', () => {
  expect(buildUmamiScripts('site-id-123')).toStrictEqual([
    {
      'data-host-url': '/site',
      'data-website-id': 'site-id-123',
      defer: true,
      // oxlint-disable-next-line zgeoff/no-abbreviated-names -- the HTML script attribute is `src`
      src: '/site.js',
    },
  ]);
});

test('it yields no tags when the website ID is not configured', () => {
  expect(buildUmamiScripts(undefined)).toStrictEqual([]);
});

test.each([
  ['an empty', ''],
  ['a whitespace-only', '   '],
])('it yields no tags for %s website ID', (_label, websiteID) => {
  expect(buildUmamiScripts(websiteID)).toStrictEqual([]);
});

test('it keeps the one tracker element the router appended across client navigations', async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <HeadContent />
        <Outlet />
      </>
    ),
    head: () => ({ scripts: buildUmamiScripts('site-id-123') }),
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([
      createRoute({
        component: () => <p>respite</p>,
        getParentRoute: () => rootRoute,
        head: () => ({ meta: [{ title: 'Respite' }] }),
        path: '/',
      }),
      createRoute({
        component: () => <p>stash</p>,
        getParentRoute: () => rootRoute,
        head: () => ({ meta: [{ title: 'Stash' }] }),
        path: '/stash',
      }),
    ]),
  });

  const rendered = render(<RouterProvider router={router} />);

  await rendered.findByText('respite');

  const appendedTracker = document.head.querySelector('script[src="/site.js"]');

  invariant(appendedTracker);

  await act(() => router.navigate({ to: '/stash' }));
  await act(() => router.navigate({ to: '/' }));

  await rendered.findByText('respite');

  expect(document.querySelectorAll('script[src="/site.js"]')).toHaveLength(1);
  expect(document.querySelector('script[src="/site.js"]')).toBe(appendedTracker);
});
