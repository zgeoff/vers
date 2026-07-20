import * as jose from 'jose';
import * as z from 'zod';

export type ServiceKeySet = ReturnType<typeof jose.createLocalJWKSet>;

const jwkShape = z.record(z.string(), z.unknown());
const jwksShape = z.object({ keys: z.array(jwkShape) });

/**
 * Parses the JSON JWKS carrying every minting issuer's public key into the key-resolver inbound
 * token verification selects from by `kid`. Malformed JSON or a shape that isn't a JWKS throws, so
 * a bad key set fails a service's boot rather than its first request.
 */
export function parseServiceJWKS(json: string): ServiceKeySet {
  return jose.createLocalJWKSet(jwksShape.parse(JSON.parse(json)));
}
