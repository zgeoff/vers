import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { activityContract } from './activity-contract';

test('it declares UNAUTHORIZED and FORBIDDEN on every owner-scoped procedure', () => {
  expect(activityContract.getCurrentActivity['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
  ]);
});

test('it declares CONFLICT and NOT_FOUND on startActivity', () => {
  expect(activityContract.startActivity['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'CONFLICT',
    'NOT_FOUND',
  ]);
});

test('it declares a bespoke CHECKPOINT_INVALID with an explicit status on trackActivityProgress', () => {
  const errorMap = activityContract.trackActivityProgress['~orpc'].errorMap;

  expect(errorMap).toContainKey('CHECKPOINT_INVALID');
  expect(errorMap.CHECKPOINT_INVALID?.status).toBe(422);
});

test('it generates a valid OpenAPI document from the activity contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(activityContract, {
    info: { title: 'contract-activity', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
