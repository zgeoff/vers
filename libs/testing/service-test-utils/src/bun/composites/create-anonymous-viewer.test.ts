import { expect, test } from 'bun:test';
import { parseServiceJWKS } from '@vers/service-auth';
import * as jose from 'jose';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';
import { createAnonymousViewer } from './create-anonymous-viewer';

test('it mints a valid token carrying no acting subject', async () => {
  const keyPair = await getTestServiceKeyPair();
  const viewer = await createAnonymousViewer({ audience: 'create-anonymous-viewer-spec' });

  const keySet = parseServiceJWKS(keyPair.jwksJSON);

  const verified = await jose.jwtVerify(viewer.token, keySet, {
    audience: 'create-anonymous-viewer-spec',
  });

  expect(verified.payload.sub).toBeUndefined();
});
