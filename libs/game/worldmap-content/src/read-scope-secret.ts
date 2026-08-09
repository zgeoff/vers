import { hexToBytes } from '@noble/hashes/utils.js';
import { createORPCClient, isDefinedError, safe } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { SecretRef, keysContract } from '@vers/contract-keys';
import { createServiceToken } from '@vers/service-auth';
import type { TokenIssuer } from '@vers/service-auth';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import type { CryptoKey } from 'jose';

const DEFAULT_KEYS_DISPATCH_TIMEOUT_MS = 10_000;

interface ReadScopeSecretDeps {
  readonly issuer: TokenIssuer;
  readonly keysServiceURL: string;
  readonly privateKey: CryptoKey;

  /**
   * Bounds the keys dispatch, so a hung keys service fails the caller rather than stalling
   * indefinitely.
   */
  readonly timeoutMs?: number;
}

interface ReadScopeSecretInput {
  readonly avatarID: string;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

/**
 * Reads an avatar's scope secret from the keys service over real s2s auth. A keys-defined
 * NOT_FOUND (an unconfigured secret version — a config bug, not caller input) is rethrown as a
 * plain `Error` naming the missing ref and version, so it can never masquerade as the caller's own
 * NOT_FOUND.
 */
export async function readScopeSecret(
  deps: Readonly<ReadScopeSecretDeps>,
  input: Readonly<ReadScopeSecretInput>,
): Promise<Uint8Array> {
  const token = await createServiceToken({
    audience: 'keys',
    issuer: deps.issuer,
    privateKey: deps.privateKey,
  });

  const client: ContractRouterClient<typeof keysContract> = createORPCClient(
    new RPCLink({
      clientInterceptors: [buildTracingInterceptor()],
      headers: { authorization: `Bearer ${token}` },
      url: `${deps.keysServiceURL}/rpc`,
    }),
  );

  const [error, result] = await safe(
    client.deriveScopeSecret(
      {
        avatarID: input.avatarID,
        secretRef: input.secretRef,
        secretVersion: input.secretVersion,
      },
      { signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_KEYS_DISPATCH_TIMEOUT_MS) },
    ),
  );

  if (error === null) {
    return hexToBytes(result.secret);
  }

  if (isDefinedError(error) && error.code === 'NOT_FOUND') {
    throw new Error(
      `keys service has no root for secretRef "${input.secretRef}" version ${input.secretVersion}`,
    );
  }

  throw error;
}
