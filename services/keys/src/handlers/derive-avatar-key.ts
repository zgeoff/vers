import { bytesToHex } from '@noble/hashes/utils.js';
import type { Population } from '@vers/contract-keys';
import { deriveAvatarKey as deriveKey } from '@vers/roll-crypto';
import type { ServiceContext } from '@vers/service-runtime';
import type { RollKeyRoots } from '../parse-roll-key-roots';
import type { UnknownKeyVersionPayload } from '../types';

/**
 * oRPC handler opts for the `deriveAvatarKey` procedure.
 */
interface DeriveAvatarKeyOpts {
  readonly context: { readonly logger: ServiceContext['logger'] };
  readonly errors: {
    readonly NOT_FOUND: (payload: UnknownKeyVersionPayload) => Error;
  };
  readonly input: {
    readonly avatarID: string;
    readonly keyVersion: number;
    readonly population: Population;
  };
}

/**
 * Derives an avatar's roll key from its population's custodied root secret, logging one audit line
 * per successful derivation. Never logs key or root material.
 */
export function deriveAvatarKey(roots: RollKeyRoots, opts: DeriveAvatarKeyOpts): { key: string } {
  const root = roots[opts.input.population].roots.get(opts.input.keyVersion);

  if (root === undefined) {
    throw opts.errors.NOT_FOUND({
      data: { keyVersion: opts.input.keyVersion, population: opts.input.population },
    });
  }

  const key = deriveKey({
    avatarID: opts.input.avatarID,
    keyVersion: opts.input.keyVersion,
    population: opts.input.population,
    root,
  });

  opts.context.logger.info(
    {
      avatarID: opts.input.avatarID,
      keyVersion: opts.input.keyVersion,
      population: opts.input.population,
    },
    'avatar key derived',
  );

  return { key: bytesToHex(key) };
}
