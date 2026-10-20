import * as jose from 'jose';
import { readTestSigningPrivateKey } from './read-test-signing-private-key';
import { resolveTestSigningKeySet } from './resolve-test-signing-key-set';

const ALGORITHM = 'EdDSA';

export async function createTestAccessToken(userID: string, expiresIn = '15m'): Promise<string> {
  const privateKey = await readTestSigningPrivateKey();
  const published = await resolveTestSigningKeySet();

  return new jose.SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM, kid: published.keyID })
    .setSubject(userID)
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}
