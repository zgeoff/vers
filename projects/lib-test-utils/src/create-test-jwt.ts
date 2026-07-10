import * as jose from 'jose';

interface TestTokenConfig {
  readonly audience: string;
  readonly issuer: string;
  readonly pkcs8Key?: jose.CryptoKey;
  readonly sub: string;
}

export async function createTestJWT(config: TestTokenConfig): Promise<string> {
  const signingKey = config.pkcs8Key ?? new TextEncoder().encode('secret');

  const jwt = await new jose.SignJWT({ sub: config.sub })
    .setProtectedHeader({ alg: config.pkcs8Key ? 'RS256' : 'HS256' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime('1h')
    .sign(signingKey);

  return jwt;
}
