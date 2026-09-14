import * as jose from 'jose';
import { buildTestSigningKeySet } from './build-test-signing-key-set';
import { readTestSigningPrivateKey } from './read-test-signing-private-key';

const ALGORITHM = 'EdDSA';

export async function createTestAccessToken(userID: string, expiresIn = '15m'): Promise<string> {
  const privateKey = await readTestSigningPrivateKey();
  const published = await buildTestSigningKeySet();

  return new jose.SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM, kid: published.keyID })
    .setSubject(userID)
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}
