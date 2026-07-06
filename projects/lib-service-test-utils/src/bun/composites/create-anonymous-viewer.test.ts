import { expect, test } from 'bun:test';
import { TOKEN_ALGORITHM } from '@vers/service-runtime';
import * as jose from 'jose';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';
import { createAnonymousViewer } from './create-anonymous-viewer';

test('it mints a valid token carrying no acting subject', async () => {
  const { publicKeyPEM } = await getTestServiceKeyPair();

  const { token } = await createAnonymousViewer({ audience: 'create-anonymous-viewer-spec' });

  const publicKey = await jose.importSPKI(publicKeyPEM, TOKEN_ALGORITHM);

  const { payload } = await jose.jwtVerify(token, publicKey, {
    audience: 'create-anonymous-viewer-spec',
  });

  expect(payload.sub).toBeUndefined();
});
