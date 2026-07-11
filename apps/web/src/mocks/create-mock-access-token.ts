import * as jose from 'jose';

const ALGORITHM = 'EdDSA';

/**
 * Signs a mock access token standing in for the session service's real one: the edge only decodes
 * its `exp` claim to decide whether the underlying session needs re-validating, so signature
 * validity doesn't matter here — reusing the app's own dev key keeps every mocked token minted the
 * same way.
 */
export async function createMockAccessToken(userID: string, expiresIn = '15m'): Promise<string> {
  const privateKey = await getPrivateKey();

  return new jose.SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userID)
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

let privateKeyPromise: Promise<jose.CryptoKey> | undefined;

function getPrivateKey(): Promise<jose.CryptoKey> {
  privateKeyPromise ??= jose.importPKCS8(readDevPrivateKey(), ALGORITHM);

  return privateKeyPromise;
}

function readDevPrivateKey(): string {
  const key = process.env['SERVICE_AUTH_PRIVATE_KEY'];

  if (key === undefined) {
    throw new Error('$SERVICE_AUTH_PRIVATE_KEY is required');
  }

  return key;
}
