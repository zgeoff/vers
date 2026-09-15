import { metrics } from '@opentelemetry/api';

type ExpiredSendTemplate = 'send-change-email-verification' | 'send-welcome';

export function recordExpiredSend(template: ExpiredSendTemplate): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-email')
    .createCounter('vers.email.expired_sends', {
      description: 'emails dropped unsent because their useful-until deadline had passed',
      unit: '{email}',
    });

  counter.add(1, { template });
}
