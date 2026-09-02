import * as jose from 'jose';
import * as z from 'zod';

export type ServiceKeySet = ReturnType<typeof jose.createLocalJWKSet>;

const jwkShape = z.looseObject({
  crv: z.literal('Ed25519'),
  kid: z.string().min(1),
  kty: z.literal('OKP'),
  x: z.string().min(1),
});

const jwksShape = z.object({ keys: z.array(jwkShape) });

export function parseServiceJWKS(json: string): ServiceKeySet {
  return jose.createLocalJWKSet(jwksShape.parse(JSON.parse(json)));
}
