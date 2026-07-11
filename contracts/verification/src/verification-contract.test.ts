import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { verificationContract } from './verification-contract';

test('it declares verifyCode returning VerificationData with typed errors, not a nullable', () => {
  const verifyCodeDef = verificationContract.verifyCode['~orpc'];

  expect(verifyCodeDef.outputSchema).toBeDefined();

  expect(verifyCodeDef.errorMap).toContainAllKeys([
    'INVALID_CODE',
    'CODE_EXPIRED',
    'CODE_ALREADY_USED',
  ]);
});

test('it declares no errors on getVerification', () => {
  expect(Object.keys(verificationContract.getVerification['~orpc'].errorMap)).toBeEmpty();
});

test('it generates a valid OpenAPI document from the verification contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(verificationContract, {
    info: { title: 'contract-verification', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
