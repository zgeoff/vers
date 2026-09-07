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

    // userInfo defaults off; the other categories default on once dataCollection is present,
    // matching what sendDefaultPii: true collected
    dataCollection: { userInfo: true },

    // tracing lives on the OpenTelemetry path; the error backend drops transaction envelopes
    tracesSampleRate: 0,

    beforeSend: (event, hint) => (isViewTransitionAbort(hint.originalException) ? null : event),
  });
}
