import type { SigningKey, SigningKeySet } from '@vers/contract-session';
import type { CryptoKey } from 'jose';
import * as jose from 'jose';

interface SigningKeys {
  readonly active: CryptoKey;
  readonly retired: ReadonlyArray<CryptoKey>;
}

export interface PublishedSigningKeys {
  readonly activeKeyID: string;
  readonly keySet: SigningKeySet;
}

// the key id is the public key's JWK thumbprint, so two deploys of one key agree on it with no
// version constant to keep in step, and a rotated key gets a new id by construction
export async function buildSigningKeySet(
  keys: Readonly<SigningKeys>,
): Promise<PublishedSigningKeys> {
  const published = await Promise.all(
    [keys.active, ...keys.retired].map((key) => toPublishedKey(key)),
  );

  const [active] = published;

  if (active === undefined) {
    throw new Error('the active signing key always publishes');
  }

  return { activeKeyID: active.kid, keySet: { keys: published } };
}

const PRIVATE_JWK_MEMBERS = ['d', 'dp', 'dq', 'k', 'oth', 'p', 'q', 'qi'] as const;

async function toPublishedKey(key: CryptoKey): Promise<SigningKey> {
  const exported = await jose.exportJWK(key);

  const publicMembers = Object.fromEntries(
    Object.entries(exported).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && !PRIVATE_JWK_MEMBERS.some((member) => member === entry[0]),
    ),
  );

  const kid = await jose.calculateJwkThumbprint(publicMembers);

  return { ...publicMembers, alg: 'RS256', kid, kty: String(exported.kty), use: 'sig' };
}
