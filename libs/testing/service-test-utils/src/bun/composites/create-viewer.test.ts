import { expect, test } from 'bun:test';
import { parseServiceJWKS } from '@vers/service-auth';
import * as jose from 'jose';
import { createTestDB } from '../create-test-db';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';
import { createViewer } from './create-viewer';

test('it persists a user and mints a token carrying that user as the acting subject', async () => {
  await using testDB = await createTestDB();

  const keyPair = await getTestServiceKeyPair();
  const viewer = await createViewer({ audience: 'create-viewer-spec', db: testDB.db });

  const keySet = parseServiceJWKS(keyPair.jwksJSON);

  const verified = await jose.jwtVerify(viewer.token, keySet, {
    audience: 'create-viewer-spec',
  });

  expect(verified.payload.sub).toBe(viewer.user.id);

  const row = await testDB.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', viewer.user.id)
    .executeTakeFirstOrThrow();

  expect(row.id).toBe(viewer.user.id);
});

test('it applies the given user and issuer overrides', async () => {
  await using testDB = await createTestDB();

  const viewer = await createViewer({
    audience: 'create-viewer-spec',
    db: testDB.db,
    issuer: 'service-activity',
    user: { email: 'viewer-override@test.com' },
  });

  expect(viewer.user.email).toBe('viewer-override@test.com');

  const header = jose.decodeProtectedHeader(viewer.token);

  expect(header.kid).toBe('service-activity');
});
