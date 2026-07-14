import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { keysContract } from './keys-contract';

test('it declares UNAUTHORIZED, FORBIDDEN, and NOT_FOUND on deriveAvatarKey', () => {
  expect(keysContract.deriveAvatarKey['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
  ]);
});

test('it generates a valid OpenAPI document from the keys contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(keysContract, {
    info: { title: 'contract-keys', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
