import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { expect, test } from 'vitest';
import { sessionContract } from './session-contract';

test('it declares TRANSACTION_MISMATCH on stepUp.consumePendingTransaction', () => {
  expect(sessionContract.stepUp.consumePendingTransaction['~orpc'].errorMap).toContainKey(
    'TRANSACTION_MISMATCH',
  );
});

test('it declares no errors on createSession', () => {
  expect(Object.keys(sessionContract.createSession['~orpc'].errorMap)).toBeEmpty();
});

test('it generates a valid OpenAPI document from the session contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(sessionContract, {
    info: { title: 'contract-session', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
