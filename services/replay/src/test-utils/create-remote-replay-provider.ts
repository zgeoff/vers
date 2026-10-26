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

  const provider = await createReplayProvider();

  provider.serve({ port: 0 });

  onTestFinished(() => provider.stop());

  const port = provider.app.server?.port;

  invariant(port !== undefined, 'provider service did not bind a port');

  return { provider, url: `http://localhost:${port}` };
}
