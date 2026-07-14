import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import * as z from 'zod';
import { buildReplayRouter } from './build-router';

/**
 * Boots the replay service; the production entrypoint and every test call this as the one shared
 * config. Stateless — no `db` to inject — so, unlike the other domain services, there is no
 * per-test config to pass.
 */
export function createReplayService(): Promise<Service<{ SIM_ENGINE_HASH: z.ZodString }>> {
  return createService({
    buildRouter: (runtime) => buildReplayRouter({ simVersion: runtime.env.SIM_ENGINE_HASH }),
    envShape: { SIM_ENGINE_HASH: z.string().min(1) },
    name: 'service-replay',
  });
}
