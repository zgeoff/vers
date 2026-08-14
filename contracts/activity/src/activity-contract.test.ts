import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import { activityContract } from './activity-contract';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from './max-catch-up-batch-checkpoints';
import { REVEAL_VIEWPORT_CELL_CAP } from './reveal-viewport-cell-cap';

test('it declares UNAUTHORIZED and FORBIDDEN on every owner-scoped procedure', () => {
  expect(activityContract.getCurrentActivity['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
  ]);
});

test('it declares CONFLICT, NOT_FOUND, NODE_NOT_REVEALED, NODE_UNKNOWN, NODE_UNREACHABLE, CHAIN_QUARANTINED, and AVATAR_NOT_ACTIVE on startActivity', () => {
  expect(activityContract.startActivity['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'AVATAR_NOT_ACTIVE',
    'CHAIN_QUARANTINED',
    'CONFLICT',
    'NODE_NOT_REVEALED',
    'NODE_UNKNOWN',
    'NODE_UNREACHABLE',
    'NOT_FOUND',
    'SIM_VERSION_EXPIRED',
    'SIM_VERSION_UNKNOWN',
  ]);
});

test('it declares a bespoke NODE_NOT_REVEALED with an explicit status on startActivity', () => {
  const errorMap = activityContract.startActivity['~orpc'].errorMap;

  expect(errorMap).toContainKey('NODE_NOT_REVEALED');
  expect(errorMap.NODE_NOT_REVEALED?.status).toBe(409);
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

test('it declares a bespoke NODE_UNREACHABLE with an explicit status on startActivity', () => {
  const errorMap = activityContract.startActivity['~orpc'].errorMap;

  expect(errorMap).toContainKey('NODE_UNREACHABLE');
  expect(errorMap.NODE_UNREACHABLE?.status).toBe(409);
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

  const checkpoint = {
    hash: 'hash',
    payload: {
      chainIndex: 0,
      entropySource: 'server-key',
      nextSeed: 'seed',
      seed: 'seed',
      time: 0,
      type: 'progress',
    },
    prevHash: 'prev',
    version: 1,
  };

  // Each continuation is under the per-array cap; only their sum trips the aggregate bound.
  const input = {
    activityID: 'act_source',
    continuations: [
      {
        buildSnapshot: { level: 1, xp: 0 },
        checkpoints: Array.from({ length: half }, () => checkpoint),
        id: 'act_continuation_1',
        startKey: 'continue_1',
      },
      {
        buildSnapshot: { level: 1, xp: 0 },
        checkpoints: Array.from({ length: half + 1 }, () => checkpoint),
        id: 'act_continuation_2',
        startKey: 'continue_2',
      },
    ],
    expectedHead: 0,
  };

  const result = activityContract.advanceActivity['~orpc'].inputSchema?.safeParse(input);

  expect(result?.success).toBe(false);
  expect(result?.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});

test('it accepts an advanceActivity request at the aggregate checkpoint cap', () => {
  const checkpoint = {
    hash: 'hash',
    payload: {
      chainIndex: 0,
      entropySource: 'server-key',
      nextSeed: 'seed',
      seed: 'seed',
      time: 0,
      type: 'progress',
    },
    prevHash: 'prev',
    version: 1,
  };

  const input = {
    activityID: 'act_source',
    continuations: [
      {
        buildSnapshot: { level: 1, xp: 0 },
        checkpoints: Array.from({ length: MAX_CATCH_UP_BATCH_CHECKPOINTS }, () => checkpoint),
        id: 'act_continuation_1',
        startKey: 'continue_1',
      },
    ],
    expectedHead: 0,
  };

  expect(activityContract.advanceActivity['~orpc'].inputSchema?.safeParse(input).success).toBe(
    true,
  );
});

test('it declares NOT_FOUND on getRevealedNodes', () => {
  expect(activityContract.getRevealedNodes['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
  ]);
});

test('getRevealedNodes accepts a viewport exactly at the cell cap', () => {
  const input = {
    avatarID: 'avatar_1',
    viewport: { maxCX: REVEAL_VIEWPORT_CELL_CAP - 1, maxCY: 0, minCX: 0, minCY: 0 },
  };

  expect(activityContract.getRevealedNodes['~orpc'].inputSchema?.safeParse(input).success).toBe(
    true,
  );
});

test('getRevealedNodes rejects a viewport whose area exceeds the cell cap', () => {
  const input = {
    avatarID: 'avatar_1',
    viewport: { maxCX: REVEAL_VIEWPORT_CELL_CAP, maxCY: 0, minCX: 0, minCY: 0 },
  };

  const result = activityContract.getRevealedNodes['~orpc'].inputSchema?.safeParse(input);

  expect(result?.error?.issues.map((issue) => issue.message)).toStrictEqual([
    `viewport area may not exceed ${REVEAL_VIEWPORT_CELL_CAP} cells`,
  ]);
});

test('getRevealedNodes rejects an inverted viewport', () => {
  const input = {
    avatarID: 'avatar_1',
    viewport: { maxCX: 0, maxCY: 0, minCX: 5, minCY: 0 },
  };

  const result = activityContract.getRevealedNodes['~orpc'].inputSchema?.safeParse(input);

  expect(result?.error?.issues.map((issue) => issue.message)).toStrictEqual([
    'viewport bounds are inverted',
  ]);
});

test('getRevealedNodes rejects a viewport axis past the packable coordinate range', () => {
  const input = {
    avatarID: 'avatar_1',
    viewport: { maxCX: WORLD_COORD_MAX + 1, maxCY: 0, minCX: WORLD_COORD_MAX, minCY: 0 },
  };

  const result = activityContract.getRevealedNodes['~orpc'].inputSchema?.safeParse(input);

  expect(result?.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['viewport', 'maxCX'] }),
  );
});

test('getRevealedNodes rejects a viewport axis below the packable coordinate range', () => {
  const input = {
    avatarID: 'avatar_1',
    viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: WORLD_COORD_MIN - 1 },
  };

  const result = activityContract.getRevealedNodes['~orpc'].inputSchema?.safeParse(input);

  expect(result?.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['viewport', 'minCY'] }),
  );
});

test('getRevealedNodes accepts a viewport at the edge of the packable coordinate range', () => {
  const input = {
    avatarID: 'avatar_1',
    viewport: {
      maxCX: WORLD_COORD_MAX,
      maxCY: WORLD_COORD_MIN + 1,
      minCX: WORLD_COORD_MAX - 1,
      minCY: WORLD_COORD_MIN,
    },
  };

  expect(activityContract.getRevealedNodes['~orpc'].inputSchema?.safeParse(input).success).toBe(
    true,
  );
});

test('it declares AVATAR_NOT_ACTIVE, NODE_UNKNOWN, and NOT_FOUND on revealNodes', () => {
  expect(activityContract.revealNodes['~orpc'].errorMap).toContainAllKeys([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'AVATAR_NOT_ACTIVE',
    'NODE_UNKNOWN',
    'NOT_FOUND',
  ]);
});

test('it declares a bespoke NODE_UNKNOWN with an explicit status on revealNodes', () => {
  const errorMap = activityContract.revealNodes['~orpc'].errorMap;

  expect(errorMap).toContainKey('NODE_UNKNOWN');
  expect(errorMap.NODE_UNKNOWN?.status).toBe(404);
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
