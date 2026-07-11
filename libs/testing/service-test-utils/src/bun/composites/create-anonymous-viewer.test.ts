import { expect, test } from 'bun:test';
import { TOKEN_ALGORITHM } from '@vers/service-auth';
import * as jose from 'jose';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';
import { createAnonymousViewer } from './create-anonymous-viewer';

test('it mints a valid token carrying no acting subject', async () => {
  const keyPair = await getTestServiceKeyPair();
  const viewer = await createAnonymousViewer({ audience: 'create-anonymous-viewer-spec' });
  const publicKey = await jose.importSPKI(keyPair.publicKeyPEM, TOKEN_ALGORITHM);

  const verified = await jose.jwtVerify(viewer.token, publicKey, {
    audience: 'create-anonymous-viewer-spec',
  });

  expect(verified.payload.sub).toBeUndefined();
});
