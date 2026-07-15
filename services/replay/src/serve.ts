import { createReplayService } from './create-replay-service';
import { getBakedEngineHash } from './get-baked-engine-hash';
import { startReplayWorker } from './worker/start-replay-worker';

// Env validation reads the process env object dynamically, which a compile-time define never
// rewrites — the baked hash must be seeded back into the environment before the service boots.
const bakedEngineHash = getBakedEngineHash();
const engineHashKey = 'SIM_ENGINE_HASH';

if (bakedEngineHash !== undefined) {
  process.env[engineHashKey] = bakedEngineHash;
}

const service = await createReplayService();

service.listen();

const worker = startReplayWorker({
  db: service.db,
  logger: service.logger,
  privateKey: service.privateKey,
  simVersion: service.env.SIM_ENGINE_HASH,
});

process.on('SIGTERM', () => {
  void handleSIGTERM();
});

async function handleSIGTERM(): Promise<void> {
  try {
    await stopGracefully();
  } catch (error) {
    service.logger.error({ err: error }, 'graceful shutdown failed');
    process.exit(1);
  }
}

/**
 * Stops accepting HTTP before draining the in-flight replay iteration, then closes the pool this
 * process opened itself — each step runs even if an earlier one rejects, so a failure never
 * strands the worker running or the pool open.
 */
async function stopGracefully(): Promise<void> {
  try {
    await service.app.stop();
  } finally {
    try {
      await worker.stop();
    } finally {
      await service.stopDB();
    }
  }
}
