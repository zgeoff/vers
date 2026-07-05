import { createId } from '@paralleldrive/cuid2';
import * as schema from '@vers/postgres-schema';
import { createTestDB } from '@vers/service-test-utils';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { expect, test } from 'vitest';
import { router } from '../router';
import { t } from '../t';

const createCaller = t.createCallerFactory(router);

interface TestConfig {
  db: PostgresJsDatabase<typeof schema>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const caller = createCaller({ db: config.db });

  return { caller };
}

test('it deletes a verification record', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  const id = createId();

  await db.insert(schema.verifications).values({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    createdAt: new Date(),
    digits: 6,
    id,
    period: 30,
    secret: 'test-secret',
    target: 'user@example.com',
    type: '2fa',
  });

  const result = await caller.deleteVerification({ id });

  expect(result).toStrictEqual({ deletedID: id });

  // Verify the record was actually deleted
  const verification = await db.query.verifications.findFirst({
    where: (verifications, operators) => operators.eq(verifications.id, id),
  });

  expect(verification).toBeUndefined();
});

test('should throw an error if the verification is not found', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const { caller } = setupTest({ db });

  await expect(caller.deleteVerification({ id: 'non-existent-id' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
    message: 'Verification not found',
  });
});
