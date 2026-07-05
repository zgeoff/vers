import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

if (import.meta.env.PROD && import.meta.env['SENTRY_DSN']) {
  // eslint-disable-next-line unicorn/prefer-top-level-await
  void import('./utils/init-sentry.client').then(({ initSentry }) =>
    initSentry(),
  );
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
  // eslint-disable-next-line unicorn/prefer-top-level-await
  void import('./mocks/browser').then(({ worker }) =>
    worker.start({
      onUnhandledRequest: (req, print) => {
        if (SILENCED_UNHANDLED_URLS.some((url) => req.url.includes(url))) {
          return;
        }

        print.warning();
      },
    }),
  );
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
