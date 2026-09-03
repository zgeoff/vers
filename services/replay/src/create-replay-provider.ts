import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import { buildProviderRouter } from './build-provider-router';
import { providerEnvShape } from './provider-env-shape';

export type ReplayProvider = Service<typeof providerEnvShape>;

export function createReplayProvider(): Promise<ReplayProvider> {
  return createService({
    buildRouter: (runtime) => buildProviderRouter({ simVersion: runtime.env.SIM_ENGINE_HASH }),
    envShape: providerEnvShape,
    name: 'service-replay-provider',
  });
}
