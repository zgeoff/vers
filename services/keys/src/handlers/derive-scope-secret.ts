import { bytesToHex } from '@noble/hashes/utils.js';
import type { SecretRef } from '@vers/contract-keys';
import { deriveScopeSecret as deriveSecret } from '@vers/roll-crypto';
import type { ServiceContext } from '@vers/service-runtime';
import { recordDeriveRejection } from '../metrics/record-derive-rejection';
import type { ScopeSecretRoots } from '../parse-scope-secret-roots';
import type { UnknownScopeSecretVersionPayload } from '../types';

interface DeriveScopeSecretOpts {
  readonly context: { readonly logger: ServiceContext['logger'] };
  readonly errors: {
    readonly NOT_FOUND: (payload: UnknownScopeSecretVersionPayload) => Error;
  };
  readonly input: {
    readonly avatarID: string;
    readonly secretRef: SecretRef;
    readonly secretVersion: number;
  };
}

export function deriveScopeSecret(
  roots: ScopeSecretRoots,
  opts: DeriveScopeSecretOpts,
): { secret: string } {
  const root = roots[opts.input.secretRef].roots.get(opts.input.secretVersion);

  if (root === undefined) {
    recordDeriveRejection('unknown-scope-secret-version');

    throw opts.errors.NOT_FOUND({
      data: { secretRef: opts.input.secretRef, secretVersion: opts.input.secretVersion },
    });
  }

  const secret = deriveSecret({
    avatarID: opts.input.avatarID,
    secretRef: opts.input.secretRef,
    secretVersion: opts.input.secretVersion,
    root,
  });

  opts.context.logger.info(
    {
      avatarID: opts.input.avatarID,
      secretRef: opts.input.secretRef,
      secretVersion: opts.input.secretVersion,
    },
    'scope secret derived',
  );

  return { secret: bytesToHex(secret) };
}
