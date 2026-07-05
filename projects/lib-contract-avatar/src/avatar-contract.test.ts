import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { expect, test } from 'vitest';
import { avatarContract } from './avatar-contract';

test('it declares UNAUTHORIZED and FORBIDDEN on every owner-scoped procedure', () => {
  expect(avatarContract.getAvatars['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
  ]);
});

test('it declares CONFLICT on createAvatar', () => {
  expect(avatarContract.createAvatar['~orpc'].errorMap).toContainKey('CONFLICT');
});

test('it generates a valid OpenAPI document from the avatar contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(avatarContract, {
    info: { title: 'contract-avatar', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
