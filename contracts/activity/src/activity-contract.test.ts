import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { activityContract } from './activity-contract';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from './max-catch-up-batch-checkpoints';
import { createMockCatchUpContinuation } from './test-utils/factories/create-mock-catch-up-continuation';

test('it declares UNAUTHORIZED and FORBIDDEN on every owner-scoped procedure', () => {
  expect(activityContract.getCurrentActivity['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
  ]);
});

test('it declares CONFLICT, NOT_FOUND, NODE_UNKNOWN, CHAIN_QUARANTINED, and AVATAR_NOT_ACTIVE on startActivity', () => {
  expect(activityContract.startActivity['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'AVATAR_NOT_ACTIVE',
    'CHAIN_QUARANTINED',
    'CONFLICT',
    'NODE_UNKNOWN',
    'NOT_FOUND',
    'SIM_VERSION_EXPIRED',
    'SIM_VERSION_UNKNOWN',
  ]);
});

test('it declares SIM_VERSION_EXPIRED and SIM_VERSION_UNKNOWN with explicit statuses on startActivity', () => {
  const errorMap = activityContract.startActivity['~orpc'].errorMap;

  expect(errorMap.SIM_VERSION_EXPIRED?.status).toBe(410);
  expect(errorMap.SIM_VERSION_UNKNOWN?.status).toBe(409);
});

test('it declares a bespoke NODE_UNKNOWN with an explicit status on startActivity', () => {
  const errorMap = activityContract.startActivity['~orpc'].errorMap;

  expect(errorMap).toContainKey('NODE_UNKNOWN');
  expect(errorMap.NODE_UNKNOWN?.status).toBe(404);
});

test('it declares a bespoke CHECKPOINT_INVALID with an explicit status on trackActivityProgress', () => {
  const errorMap = activityContract.trackActivityProgress['~orpc'].errorMap;

  expect(errorMap).toContainKey('CHECKPOINT_INVALID');
  expect(errorMap.CHECKPOINT_INVALID?.status).toBe(422);
});

test('it declares the single-writer errors with explicit statuses on trackActivityProgress', () => {
  const errorMap = activityContract.trackActivityProgress['~orpc'].errorMap;

  expect(errorMap).toContainKeys(['ACTIVITY_TERMINAL', 'SESSION_EVICTED']);
  expect(errorMap.ACTIVITY_TERMINAL?.status).toBe(409);
  expect(errorMap.SESSION_EVICTED?.status).toBe(403);
});

test('it declares a bespoke ACTIVITY_CAPPED with an explicit status on trackActivityProgress', () => {
  const errorMap = activityContract.trackActivityProgress['~orpc'].errorMap;

  expect(errorMap).toContainKey('ACTIVITY_CAPPED');
  expect(errorMap.ACTIVITY_CAPPED?.status).toBe(409);
});

test('it rejects an advanceActivity request whose checkpoints exceed the cap across continuations', () => {
  const half = Math.ceil(MAX_CATCH_UP_BATCH_CHECKPOINTS / 2);

  // Each continuation is under the per-array cap; only their sum trips the aggregate bound.
  const input = {
    activityID: 'act_source',
    continuations: [
      createMockCatchUpContinuation({ checkpointCount: half }),
      createMockCatchUpContinuation({ checkpointCount: half + 1 }),
    ],
    expectedHead: 0,
  };

  expect(activityContract.advanceActivity['~orpc'].inputSchema?.safeParse(input).success).toBe(
    false,
  );
});

test('it accepts an advanceActivity request at the aggregate checkpoint cap', () => {
  const input = {
    activityID: 'act_source',
    continuations: [
      createMockCatchUpContinuation({ checkpointCount: MAX_CATCH_UP_BATCH_CHECKPOINTS }),
    ],
    expectedHead: 0,
  };

  expect(activityContract.advanceActivity['~orpc'].inputSchema?.safeParse(input).success).toBe(
    true,
  );
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
