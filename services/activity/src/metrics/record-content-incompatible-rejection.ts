import { metrics } from '@opentelemetry/api';

export type ContentIncompatiblePath = 'fallback' | 'requested';

/**
 * Counts one `startActivity` call rejected because the resolved engine's `maxContentVersion` falls
 * behind the content version the request would stamp, split by which resolution path found the
 * mismatch: `requested` covers a client-sent hash, `fallback` covers the registry-current version
 * the transitional hash-less path resolves. The counter is resolved through the global metrics API
 * on every call — the SDK returns the same instrument for an identical registration, and resolving
 * late keeps the counter bound to whichever meter provider the process registered at boot; without
 * one it is the API's no-op.
 */
export function recordContentIncompatibleRejection(path: ContentIncompatiblePath): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.content_incompatible_rejections', {
      description:
        "startActivity calls rejected because the resolved engine's max content version falls behind the requested content",
      unit: '{rejection}',
    });

  counter.add(1, { path });
}
