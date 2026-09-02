import * as jose from 'jose';

const ALGORITHM = 'EdDSA';

export async function createTestAccessToken(userID: string, expiresIn = '15m'): Promise<string> {
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
