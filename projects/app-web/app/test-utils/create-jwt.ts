import * as jose from 'jose';

interface JWTConfig {
  audience: string;
  expirationTime?: string;
  issuer: string;
  sub: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function createJWT(config: JWTConfig): Promise<string> {
  const signingKey = new TextEncoder().encode('secret');

  const jwt = await new jose.SignJWT({ sub: config.sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime(config.expirationTime ?? '1h')
    .sign(signingKey);

  return jwt;
}
