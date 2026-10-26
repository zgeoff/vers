import { createReplayService } from './create-replay-service';
import { readBakedEngineHash } from './read-baked-engine-hash';
import { runScheduledDrain } from './run-scheduled-drain';

// Env validation reads the process env object dynamically, which a compile-time define never
// rewrites — the baked hash must be seeded back into the environment before the service boots.
const bakedEngineHash = readBakedEngineHash();
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

const exitCode = await runScheduledDrain(service);

process.exit(exitCode);
