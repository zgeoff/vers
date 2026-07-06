import { expect, test } from 'bun:test';
import { TOKEN_ALGORITHM } from '@vers/service-runtime';
import * as jose from 'jose';
import { createTestDB } from '../create-test-db';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';
import { createViewer } from './create-viewer';

test('it persists a user and mints a token carrying that user as the acting subject', async () => {
  await using testDB = await createTestDB();
  const { publicKeyPEM } = await getTestServiceKeyPair();

  const { token, user } = await createViewer({ audience: 'create-viewer-spec', db: testDB.db });

  const publicKey = await jose.importSPKI(publicKeyPEM, TOKEN_ALGORITHM);
  const { payload } = await jose.jwtVerify(token, publicKey, { audience: 'create-viewer-spec' });

  expect(payload.sub).toBe(user.id);

  const row = await testDB.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.id).toBe(user.id);
});

test('it applies the given user overrides', async () => {
  await using testDB = await createTestDB();

  const { user } = await createViewer({
    audience: 'create-viewer-spec',
    db: testDB.db,
    user: { email: 'viewer-override@test.com' },
  });

  expect(user.email).toBe('viewer-override@test.com');
});
