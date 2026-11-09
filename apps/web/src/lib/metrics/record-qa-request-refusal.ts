import { metrics } from '@opentelemetry/api';
import type { QARequestRefusal } from '../qa-seed/types';

export function recordQARequestRefusal(reason: QARequestRefusal): void {
  // Resolved on every call: the SDK returns the same instrument for an identical registration, and
  // resolving late keeps it bound to whichever meter provider the process registered at boot;
  // without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/web').createCounter('vers.web.qa_request_refusals', {
    description: 'requests to the QA seeding route refused before they reached a service',
    unit: '{request}',
  });

  counter.add(1, { reason });
}
