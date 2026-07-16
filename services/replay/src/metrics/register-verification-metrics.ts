import { metrics } from '@opentelemetry/api';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type pino from 'pino';
import { loadVerificationSnapshot } from './load-verification-snapshot';

interface RegisterVerificationMetricsDeps {
  readonly db: Kysely<DB>;
  readonly logger: pino.Logger;
}

/**
 * Registers the verification pipeline's observable gauges on the process's global meter: worst
 * unverified append age, appended-vs-verified head delta (p95), quarantined count, and the parked
 * backlog per sim version. All four observe from one database snapshot per metrics collection.
 * In a process without a registered meter provider the callback never runs, so registration
 * costs nothing there.
 */
export function registerVerificationMetrics(deps: RegisterVerificationMetricsDeps): void {
  const meter = metrics.getMeter('@vers/service-replay');

  const lag = meter.createObservableGauge('vers.verification.lag', {
    description: 'age of the oldest unverified append across activity streams',
    unit: 's',
  });

  const headDelta = meter.createObservableGauge('vers.verification.head_delta.p95', {
    description: 'p95 of appended-head minus verified-head over unverified activity streams',
    unit: '{checkpoint}',
  });

  const quarantined = meter.createObservableGauge('vers.verification.quarantined', {
    description: 'activities quarantined after exhausting replay attempts',
    unit: '{activity}',
  });

  const parked = meter.createObservableGauge('vers.verification.parked', {
    description: 'activities parked for operator resolution, by stamped sim version',
    unit: '{activity}',
  });

  meter.addBatchObservableCallback(
    async (observer) => {
      // a snapshot failure must never take down the process the gauges observe
      try {
        const snapshot = await loadVerificationSnapshot(deps.db);

        observer.observe(lag, snapshot.lagSeconds);
        observer.observe(headDelta, snapshot.headDeltaP95);
        observer.observe(quarantined, snapshot.quarantinedCount);

        for (const entry of snapshot.parkedBySimVersion) {
          observer.observe(parked, entry.count, { sim_version: entry.simVersion });
        }
      } catch (error) {
        deps.logger.error({ err: error }, 'verification metrics snapshot failed');
      }
    },
    [lag, headDelta, quarantined, parked],
  );
}
