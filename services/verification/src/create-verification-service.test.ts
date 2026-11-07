import { expect, mock, onTestFinished, spyOn, test } from 'bun:test';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { createVerificationService } from './create-verification-service';
import { readVerification } from './handlers/read-verification';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  const service = await createVerificationService({ db: db.db });
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(service.app, { token: viewer.token });

  await client.createVerification({ target: 'wired@example.com', type: 'onboarding' });

  const verification = await readVerification(db.db, {
    input: { target: 'wired@example.com', type: 'onboarding' },
  });

  expect(verification?.target).toBe('wired@example.com');
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createVerificationService();

  onTestFinished(() => service.stop());

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it stops serving, destroys the db it built and exits 0 on SIGTERM', async () => {
  const exit = mock((_code: number) => {});

  const service = await createVerificationService();

  onTestFinished(() => service.stop());

  const destroy = spyOn(service.resources.db, 'destroy');

  service.serve({ exit, port: 0 });
  process.emit('SIGTERM');

  await waitFor(() => {
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  expect(destroy).toHaveBeenCalledOnce();
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

  const verification = await readVerification(db.db, {
    input: { target: 'rejected@example.com', type: 'onboarding' },
  });

  expect(verification).toBeNull();
});
