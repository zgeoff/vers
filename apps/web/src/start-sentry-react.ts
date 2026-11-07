import * as Sentry from '@sentry/react';
import { isViewTransitionAbort } from './lib/is-view-transition-abort';

export function startSentryReact(): void {
  const dsn: string | undefined = import.meta.env['VITE_SENTRY_DSN'];

  if (dsn === undefined) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,

    // on, the SDK gives an event from a non-Error value a synthetic stack of the capture site, which
    // splits its issue group in the error backend
    attachStacktrace: false,

    // the user's identity goes on each event, and every other category keeps the SDK's default
    dataCollection: { userInfo: true },

    // tracing lives on the OpenTelemetry path; the error backend drops transaction envelopes
    tracesSampleRate: 0,

    beforeSend: (event, hint) => (isViewTransitionAbort(hint.originalException) ? null : event),
  });
}
