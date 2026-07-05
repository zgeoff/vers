import React from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router';
import * as Sentry from '@sentry/react';

export function initSentry() {
  Sentry.init({
    beforeSend(event) {
      if (event.request?.url) {
        const url = new URL(event.request.url);

        const isBrowserExtension =
          url.protocol === 'chrome-extension:' ||
          url.protocol === 'moz-extension:';

        if (isBrowserExtension) {
          return null;
        }
      }

      return event;
    },
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
