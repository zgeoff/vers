import type { SigningKeySet } from './signing-key-set-schema';

interface JSONWebKeySet {
  readonly keys: Array<Record<string, string>>;
}

// a verifier takes a mutable JWKS; the published set is readonly wire data, so each key is copied
export function toJSONWebKeySet(published: SigningKeySet): JSONWebKeySet {
  return { keys: published.keys.map((key) => ({ ...key })) };
}
