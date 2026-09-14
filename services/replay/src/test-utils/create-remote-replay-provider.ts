import { onTestFinished } from 'bun:test';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import { updateEnv } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { buildProviderRouter } from '../build-provider-router';
import { providerEnvShape } from '../provider-env-shape';

interface RemoteReplayProvider {
  readonly provider: Service<typeof providerEnvShape>;
  readonly url: string;
}

export async function createRemoteReplayProvider(
  engineHash: string,
): Promise<RemoteReplayProvider> {
  updateEnv('SIM_ENGINE_HASH', engineHash);

  // named and audienced as `service-replay`, matching the dispatcher's current mint
  // (`services/replay/src/dispatch/run-replay-segment.ts`), rather than the real provider's own
  // `service-replay-provider` audience
  const provider = await createService({
    allowedIssuers: ['service-replay'],
    buildRouter: (runtime) => buildProviderRouter({ simVersion: runtime.env.SIM_ENGINE_HASH }),
    envShape: providerEnvShape,
    name: 'service-replay',
  });

  provider.listen(0);

  onTestFinished(async () => {
    await provider.app.stop();
    await provider.stopTelemetry();
  });

  const port = provider.app.server?.port;

  invariant(port !== undefined, 'provider service did not bind a port');

  return { provider, url: `http://localhost:${port}` };
}
