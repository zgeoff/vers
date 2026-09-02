import { flushErrorReports, reportUnexpectedError } from '@vers/service-runtime';
import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
import { createReplayProvider } from './create-replay-provider';
import { getBakedEngineHash } from './get-baked-engine-hash';

// Env validation reads the process env object dynamically, which a compile-time define never
// rewrites — the baked hash must be seeded back into the environment before the service boots.
const bakedEngineHash = getBakedEngineHash();
const engineHashKey = 'SIM_ENGINE_HASH';

if (bakedEngineHash !== undefined) {
  process.env[engineHashKey] = bakedEngineHash;
}

const service = await createReplayProvider();

service.listen();

process.on('SIGTERM', () => {
  void handleSIGTERM();
});

async function handleSIGTERM(): Promise<void> {
  // the try/catch lives inside the trace scope so a shutdown report still carries its trace id
  await withTraceContext(createTraceContext(), async () => {
    try {
      await stopGracefully();
    } catch (error) {
      service.logger.error({ err: error }, 'graceful shutdown failed');

      reportUnexpectedError(error);

      const flushed = await flushErrorReports();

      if (!flushed) {
        service.logger.warn('error reports were still queued when the flush timed out');
      }

      process.exit(1);
    }
  });
}

async function stopGracefully(): Promise<void> {
  try {
    await service.app.stop();
  } finally {
    await service.stopTelemetry();
  }
}
