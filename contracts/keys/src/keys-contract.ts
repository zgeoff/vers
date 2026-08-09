import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { PopulationSchema } from './population-schema';
import { SecretRefSchema } from './secret-ref-schema';

const NotFoundErrorDataSchema = z.object({ keyVersion: z.int(), population: PopulationSchema });

const ScopeSecretNotFoundErrorDataSchema = z.object({
  secretRef: SecretRefSchema,
  secretVersion: z.int(),
});

/**
 * The keys service's API: derives an avatar's roll key or scope secret from its custodied root
 * secrets. Every procedure is authed at the s2s transport boundary; no acting-user session is
 * involved.
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
  deriveScopeSecret: authedRoute
    .route({ method: 'POST', path: '/scope-secrets', summary: 'Derive an avatar scope secret' })
    .input(
      z.object({
        avatarID: z.string().min(1),
        secretRef: SecretRefSchema,
        secretVersion: z.int().min(1),
      }),
    )
    .output(z.object({ secret: z.string().length(64) }))
    .errors(
      defineErrors({
        NOT_FOUND: {
          data: ScopeSecretNotFoundErrorDataSchema,
          message: 'unknown secret version for scope',
        },
      }),
    ),
};

export type KeysContract = typeof keysContract;
