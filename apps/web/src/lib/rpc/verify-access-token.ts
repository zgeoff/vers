import { toJSONWebKeySet } from '@vers/contract-session';
import * as jose from 'jose';
import { sessionKeysClient } from './clients/session-keys-client';

export type AccessTokenVerdict =
  | { readonly kind: 'expired'; readonly userID: string }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'valid'; readonly userID: string };

const REFRESH_SKEW_SECONDS = 30;

type LocalKeySet = ReturnType<typeof jose.createLocalJWKSet>;

// one key set per process, re-read once when a token names a key the set lacks: that is what a
// rotation looks like from the edge, and a re-read that still lacks the key is a forged token
let keySet: Promise<LocalKeySet> | undefined;

export async function verifyAccessToken(token: string): Promise<AccessTokenVerdict> {
  const first = await tryVerifyAgainstPublishedKeys(token);

  if (first.kind !== 'unknown-key') {
    return first;
  }

  keySet = undefined;

  const second = await tryVerifyAgainstPublishedKeys(token);

  return second.kind === 'unknown-key' ? { kind: 'invalid' } : second;
}

type VerifyAttempt = AccessTokenVerdict | { readonly kind: 'unknown-key' };

async function tryVerifyAgainstPublishedKeys(token: string): Promise<VerifyAttempt> {
  const keys = await resolveKeySet();

  let payload: jose.JWTPayload;

  try {
    const verified = await jose.jwtVerify(token, keys);

    payload = verified.payload;
  } catch (error) {
    if (error instanceof jose.errors.JWKSNoMatchingKey) {
      return { kind: 'unknown-key' };
    }

    // the signature is checked before the claims, so an expired token's subject is still trusted
    if (error instanceof jose.errors.JWTExpired && typeof error.payload.sub === 'string') {
      return { kind: 'expired', userID: error.payload.sub };
    }

    return { kind: 'invalid' };
  }

  if (typeof payload.sub !== 'string') {
    return { kind: 'invalid' };
  }

  // a token inside the refresh skew reads as expired so the refresh runs before it lapses mid-call
  if (payload.exp === undefined || payload.exp <= Date.now() / 1000 + REFRESH_SKEW_SECONDS) {
    return { kind: 'expired', userID: payload.sub };
  }

  return { kind: 'valid', userID: payload.sub };
}

function resolveKeySet(): Promise<LocalKeySet> {
  keySet ??= readPublishedKeySet();

  return keySet;
}

async function readPublishedKeySet(): Promise<LocalKeySet> {
  try {
    const published = await sessionKeysClient.getSigningKeys({});

    return jose.createLocalJWKSet(toJSONWebKeySet(published));
  } catch (error) {
    keySet = undefined;
    throw error;
  }
}
