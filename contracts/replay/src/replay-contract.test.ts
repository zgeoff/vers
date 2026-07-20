import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { replayContract } from './replay-contract';

test('it declares UNAUTHORIZED, FORBIDDEN, and a bespoke SIM_VERSION_MISMATCH on replaySegment', () => {
  const replaySegmentDef = replayContract.replaySegment['~orpc'];

  expect(replaySegmentDef.outputSchema).toBeDefined();

  expect(replaySegmentDef.errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'SIM_VERSION_MISMATCH',
  ]);

  expect(replaySegmentDef.errorMap.SIM_VERSION_MISMATCH?.status).toBe(409);
});

test('it declares no bespoke error codes on wake', () => {
  const wakeDef = replayContract.wake['~orpc'];

  expect(wakeDef.outputSchema).toBeDefined();
  expect(Object.keys(wakeDef.errorMap).toSorted()).toStrictEqual(['FORBIDDEN', 'UNAUTHORIZED']);
});

test('it generates a valid OpenAPI document from the replay contract', async () => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(replayContract, {
    info: { title: 'contract-replay', version: '0.0.0' },
  });

  const pathCount = Object.keys(document.paths!).length;

  expect(document.openapi).toBeDefined();
  expect(pathCount).toBeGreaterThan(0);
});
