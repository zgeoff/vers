import { metrics } from '@opentelemetry/api';
import type { TokenIssuer } from '@vers/service-auth';

interface RecordCallerRejectionOptions {
  readonly issuer: TokenIssuer;
  readonly service: string;
}

export function recordCallerRejection(options: Readonly<RecordCallerRejectionOptions>): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-runtime')
    .createCounter('vers.service.caller_rejections', {
      description:
        "inbound service calls refused because the token's issuer is not a permitted caller of the target service",
      unit: '{rejection}',
    });

  counter.add(1, { issuer: options.issuer, service: options.service });
}
