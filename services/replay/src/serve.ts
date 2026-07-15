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
  privateKey: await service.privateKey,
  simVersion: service.env.SIM_ENGINE_HASH,
});

process.on('SIGTERM', () => {
  void stopGracefully();
});

async function stopGracefully(): Promise<void> {
  await worker.stop();
  await service.app.stop();
}
