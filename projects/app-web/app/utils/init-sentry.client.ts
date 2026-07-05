import * as Sentry from '@sentry/react';
import React from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router';

export function initSentry() {
  Sentry.init({
    beforeSend(event) {
      // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
      if (event.request?.url) {
        const url = new URL(event.request.url);

        const isBrowserExtension =
          url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:';

        if (isBrowserExtension) {
          return null;
        }
      }

      return event;
    },
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    dsn: import.meta.env['SENTRY_DSN'],
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.replayIntegration(),
      Sentry.browserProfilingIntegration(),
      Sentry.reactRouterV7BrowserTracingIntegration({
        createRoutesFromChildren,
        matchRoutes,
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
      }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance
    // monitoring. We recommend adjusting this value in production
    tracesSampleRate: 1,

    // Capture Replay for 10% of all sessions, plus for 100% of sessions with an error
    replaysOnErrorSampleRate: 1,
    replaysSessionSampleRate: 0.1,
  });
}
