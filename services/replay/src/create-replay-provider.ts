import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import { buildProviderRouter } from './build-provider-router';
import { providerEnvShape } from './provider-env-shape';

export type ReplayProvider = Service<typeof providerEnvShape>;

/**
 * Boots the provider-mode replay service; the provider entrypoint is the one caller. No database
 * pool, no worker deps, no signing key — the narrowed env shape has nothing for them to resolve
 * from.
 */
export function createReplayProvider(): Promise<ReplayProvider> {
  return createService({
    buildRouter: (runtime) => buildProviderRouter({ simVersion: runtime.env.SIM_ENGINE_HASH }),
    envShape: providerEnvShape,
    name: 'service-replay-provider',
  });
}
