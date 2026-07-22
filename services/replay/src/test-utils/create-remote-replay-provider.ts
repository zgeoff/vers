import { onTestFinished } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { createReplayService } from '../create-replay-service';
import type { ReplayService } from '../create-replay-service';

interface RemoteReplayProvider {
  readonly provider: ReplayService;
  readonly url: string;
}

/**
 * Boots a second replay instance baked with a given engine hash, listening on an ephemeral port,
 * so a cross-version dispatch test has a real provider to round-trip against; stopped via
 * `onTestFinished`.
 */
export async function createRemoteReplayProvider(
  engineHash: string,
): Promise<RemoteReplayProvider> {
  updateEnv('SIM_ENGINE_HASH', engineHash);

  const provider = await createReplayService();

  provider.listen(0);

  onTestFinished(() => provider.app.stop());

  const port = provider.app.server?.port;

  invariant(port !== undefined, 'provider service did not bind a port');

  return { provider, url: `http://localhost:${port}` };
}
