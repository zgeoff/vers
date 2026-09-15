import { expect, test } from 'bun:test';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createVerificationService } from './create-verification-service';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  const service = await createVerificationService({ db: db.db });
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(service.app, { token: viewer.token });

  await client.createVerification({ target: 'wired@example.com', type: 'onboarding' });

  const rows = await db.db.selectFrom('verifications').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createVerificationService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it accepts a call from app-web', async () => {
  await using db = await createTestDB();

  const service = await createVerificationService({ db: db.db });

  const viewer = await createAnonymousViewer({
    audience: 'service-verification',
    issuer: 'app-web',
  });

  const client = buildRPCTestClient<VerificationContract>(service.app, { token: viewer.token });

  await expect(
    client.createVerification({ target: 'accepted@example.com', type: 'onboarding' }),
  ).toResolve();
});

test('it rejects a call from service-activity with 403', async () => {
  await using db = await createTestDB();

  const service = await createVerificationService({ db: db.db });

  const viewer = await createAnonymousViewer({
    audience: 'service-verification',
    issuer: 'service-activity',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/createVerification', {
      body: JSON.stringify({ json: { target: 'rejected@example.com', type: 'onboarding' } }),
      headers: {
        authorization: `Bearer ${viewer.token}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(403);

  const rows = await db.db.selectFrom('verifications').selectAll().execute();

  expect(rows).toHaveLength(0);
});
