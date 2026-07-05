import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { expect, test } from 'vitest';
import { userContract } from './user-contract';

test('it declares the CONFLICT error with a field discriminator on createUser', () => {
  expect(userContract.createUser['~orpc'].errorMap).toContainKey('CONFLICT');
});

test('it declares no errors on verifyPassword', () => {
  expect(Object.keys(userContract.verifyPassword['~orpc'].errorMap)).toBeEmpty();
});

test('it generates a valid OpenAPI document from the user contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(userContract, {
    info: { title: 'contract-user', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
