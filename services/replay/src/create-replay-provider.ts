import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import { buildProviderRouter } from './build-provider-router';
import { providerEnvShape } from './provider-env-shape';

export type ReplayProvider = Service<typeof providerEnvShape>;

interface CreateReplayProviderConfig {
  readonly name?: string;
}

export function createReplayProvider(
  config: Readonly<CreateReplayProviderConfig> = {},
): Promise<ReplayProvider> {
  return createService({
    allowedIssuers: ['service-replay'],
    buildRouter: (runtime) => buildProviderRouter({ simVersion: runtime.env.SIM_ENGINE_HASH }),
    envShape: providerEnvShape,
    name: config.name ?? 'service-replay-provider',
  });
}
