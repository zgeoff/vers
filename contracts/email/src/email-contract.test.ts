import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { emailContract } from './email-contract';

test('it declares no bespoke errors on any procedure', () => {
  for (const procedure of Object.values(emailContract)) {
    expect(Object.keys(procedure['~orpc'].errorMap)).toBeEmpty();
  }
});

test('it generates a valid OpenAPI document from the email contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(emailContract, {
    info: { title: 'contract-email', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
