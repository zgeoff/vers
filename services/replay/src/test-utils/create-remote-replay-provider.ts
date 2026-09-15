import { onTestFinished } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { createReplayProvider } from '../create-replay-provider';
import type { ReplayProvider } from '../create-replay-provider';

interface RemoteReplayProvider {
  readonly provider: ReplayProvider;
  readonly url: string;
}

export async function createRemoteReplayProvider(
  engineHash: string,
): Promise<RemoteReplayProvider> {
  updateEnv('SIM_ENGINE_HASH', engineHash);

  // named `service-replay`, the audience baked into the token run-replay-segment.ts mints
  // (`services/replay/src/dispatch/`) from its `replay` argument, rather than the real provider's
  // own `service-replay-provider` name — a pre-existing defect this fix doesn't address
  const provider = await createReplayProvider({ name: 'service-replay' });

  provider.listen(0);

  onTestFinished(async () => {
    await provider.app.stop();
    await provider.stopTelemetry();
  });

  const port = provider.app.server?.port;

  invariant(port !== undefined, 'provider service did not bind a port');

  return { provider, url: `http://localhost:${port}` };
}
