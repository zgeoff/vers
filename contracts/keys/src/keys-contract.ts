import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { PopulationSchema } from './population-schema';

const NotFoundErrorDataSchema = z.object({ keyVersion: z.int(), population: PopulationSchema });

/**
 * The keys service's API: derives an avatar's roll key from its custodied root secrets. Every
 * procedure is authed at the s2s transport boundary; no acting-user session is involved.
 */
export const keysContract = {
  deriveAvatarKey: authedRoute
    .route({ method: 'POST', path: '/avatar-keys', summary: 'Derive an avatar roll key' })
    .input(
      z.object({
        avatarID: z.string().min(1),
        keyVersion: z.int().min(1),
        population: PopulationSchema,
      }),
    )
    .output(z.object({ key: z.string().length(64) }))
    .errors(
      defineErrors({
        NOT_FOUND: {
          data: NotFoundErrorDataSchema,
          message: 'unknown key version for population',
        },
      }),
    ),
};

export type KeysContract = typeof keysContract;
