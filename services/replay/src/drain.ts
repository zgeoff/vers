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

// error reporting starts inside the service boot, so a boot failure has nowhere to report but
// stderr, which Fly keeps beside the machine's exit code
const service = await createReplayService().catch((error: unknown) => {
  console.error('scheduled replay drain could not boot', error);

  return process.exit(1);
});

await withTraceContext(createTraceContext(), runScheduledDrain);

// a teardown fault is reported too, and the flush runs whatever the teardown did
try {
  await service.stopTelemetry();
} catch (error) {
  service.logger.error({ err: error }, 'telemetry stop failed after the scheduled drain');

  reportUnexpectedError(error);
} finally {
  await service.stopDB().catch((error: unknown) => {
    service.logger.error({ err: error }, 'database stop failed after the scheduled drain');

    reportUnexpectedError(error);
  });
}

const flushed = await flushErrorReports();

if (!flushed) {
  service.logger.warn('error reports were still queued when the flush timed out');
}

process.exit(process.exitCode ?? 0);

// the try/catch lives inside the trace scope so a drain failure report still carries its trace id
async function runScheduledDrain(): Promise<void> {
  try {
    const drained = await service.drain('schedule');

    service.logger.info({ drained }, 'drained the replay queue on schedule');
  } catch (error) {
    service.logger.error({ err: error }, 'scheduled replay drain failed');

    reportUnexpectedError(error);

    process.exitCode = 1;
  }
}
