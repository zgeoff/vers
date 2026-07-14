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

service.listen();
