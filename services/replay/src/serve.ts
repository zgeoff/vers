import { flushErrorReports, reportUnexpectedError } from '@vers/service-runtime';
import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
import { createReplayService } from './create-replay-service';
import { getBakedEngineHash } from './get-baked-engine-hash';
import { registerVerificationMetrics } from './metrics/register-verification-metrics';
import { startReplayWorker } from './worker/start-replay-worker';

// Env validation reads the process env object dynamically, which a compile-time define never
// rewrites — the baked hash must be seeded back into the environment before the service boots.
const bakedEngineHash = getBakedEngineHash();
const engineHashKey = 'SIM_ENGINE_HASH';

if (bakedEngineHash !== undefined) {
  process.env[engineHashKey] = bakedEngineHash;
}

const service = await createReplayService();

registerVerificationMetrics({ db: service.db, logger: service.logger });

service.listen();

const worker = startReplayWorker({
  db: service.db,
  keysServiceURL: service.env.KEYS_SERVICE_URL,
  logger: service.logger,
  privateKey: service.privateKey,
  simVersion: service.env.SIM_ENGINE_HASH,
});

service.logger.info('replay worker started');

process.on('SIGTERM', () => {
  void handleSIGTERM();
});

async function handleSIGTERM(): Promise<void> {
  try {
    await withTraceContext(createTraceContext(), stopGracefully);
  } catch (error) {
    service.logger.error({ err: error }, 'graceful shutdown failed');

    reportUnexpectedError(error);

    await flushErrorReports();

    process.exit(1);
  }
}

/**
 * Stops accepting HTTP before draining the in-flight replay iteration, then flushes telemetry
 * while the pool is still open (the final gauge collection may query it) before closing the pool
 * this process opened itself — each step runs even if an earlier one rejects, so a failure never
 * strands the worker running, telemetry timers live, or the pool open.
 */
async function stopGracefully(): Promise<void> {
  try {
    await service.app.stop();
  } finally {
    try {
      await worker.stop();
    } finally {
      try {
        await service.stopTelemetry();
      } finally {
        await service.stopDB();
      }
    }
  }
}
