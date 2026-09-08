import { flushErrorReports, reportUnexpectedError } from '@vers/service-runtime';
import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
import { createReplayService } from './create-replay-service';
import { getBakedEngineHash } from './get-baked-engine-hash';

// Env validation reads the process env object dynamically, which a compile-time define never
// rewrites — the baked hash must be seeded back into the environment before the service boots.
const bakedEngineHash = getBakedEngineHash();
const engineHashKey = 'SIM_ENGINE_HASH';

if (bakedEngineHash !== undefined) {
  process.env[engineHashKey] = bakedEngineHash;
}

const service = await createReplayService();

// the try/catch lives inside the trace scope so a drain failure report still carries its trace id
await withTraceContext(createTraceContext(), async () => {
  try {
    const drained = await service.drain('schedule');

    service.logger.info({ drained }, 'drained the replay queue on schedule');
  } catch (error) {
    service.logger.error({ err: error }, 'scheduled replay drain failed');

    reportUnexpectedError(error);

    process.exitCode = 1;
  }
});

try {
  await service.stopTelemetry();
} finally {
  await service.stopDB();
}

// reports captured during the drain (a backed-off iteration's fault) still need delivery before
// the process dies
const flushed = await flushErrorReports();

if (!flushed) {
  service.logger.warn('error reports were still queued when the flush timed out');
}

process.exit(process.exitCode ?? 0);
