import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

if (import.meta.env.PROD && import.meta.env['SENTRY_DSN']) {
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- sentry init is deliberately fire-and-forget so it never delays hydration
  void (async () => {
    const { initSentry } = await import('./utils/init-sentry.client');

    initSentry();
  })();
}

const SILENCED_UNHANDLED_URLS = [
  'node_modules',
  '/__manifest',
  '.woff',
  '.svg',
  '.css',
  '.png',
  '.ts',
  '.tsx',
  '.data',
  'sentry.io',
];

if (!import.meta.env.PROD && import.meta.env.VITE_ENABLE_MSW === 'true') {
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- msw worker start is deliberately fire-and-forget so it never delays hydration
  void (async () => {
    const { worker } = await import('./mocks/browser');

    await worker.start({
      onUnhandledRequest: (req, print) => {
        if (SILENCED_UNHANDLED_URLS.some((url) => req.url.includes(url))) {
          return;
        }

        print.warning();
      },
    });
  })();
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
