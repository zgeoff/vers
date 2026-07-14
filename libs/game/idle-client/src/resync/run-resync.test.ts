import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData } from '@vers/contract-activity';
import {
  ActivityFailureAction,
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core';
import { ACTIVITY_SERVICE_URL, mockActivityService } from '../mocks/mock-activity-service';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { createMockActivityData } from '../test-utils/factories/create-mock-activity-data';
import { runResync } from './run-resync';

function buildActivityInput(activity: ActivityData) {
  return createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Abort,
    id: activity.id,
    seed: activity.seed,
  });
}

function setupTest() {
  const link = new RPCLink({ url: `${ACTIVITY_SERVICE_URL}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);
  const onInvalid = mock<(activityID: string, reason: string) => void>();
  const submitter = createCheckpointSubmitter({ client, onInvalid });

  return { buildActivityInput, client, submitter };
}

test('it resolves to none for an avatar with no activity history', async () => {
  const ctx = setupTest();

  server.use(
    mockActivityService.getLatestActivityProgress.handler((opts) => {
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  const result = await runResync({
    avatar: createMockAvatarData(),
    avatarID: 'avatar_1',
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result).toStrictEqual({ plan: { kind: 'none' } });
});

test('it rebases from the stop index without simulating when the activity is capped', async () => {
  const ctx = setupTest();
  const activity = createMockActivityData({ appendedHead: 5, status: 'capped' });

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 5,
      serverTime: new Date(),
      verifiedHead: 3,
    })),
  );

  const result = await runResync({
    avatar: createMockAvatarData(),
    avatarID: activity.avatarID,
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.report).toBeUndefined();

  expect(result.plan).toStrictEqual({
    context: {
      activityID: activity.id,
      appendedHead: 5,
      lastHash: activity.lastHash,
      startChainIndex: activity.startChainIndex,
    },
    kind: 'rebase',
  });
});

test('it attaches live when the gap is negligible', async () => {
  const ctx = setupTest();

  const serverTime = new Date();

  const activity = createMockActivityData({ appendedAt: new Date(serverTime.getTime() - 2000) });

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 0,
      serverTime,
      verifiedHead: 0,
    })),
  );

  const result = await runResync({
    avatar: createMockAvatarData(),
    avatarID: activity.avatarID,
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.plan.kind).toBe('attach-live');
  expect(result.report).toBeUndefined();
});

test('it fast-forwards a real offline gap and reports the outcome', async () => {
  const ctx = setupTest();

  const serverTime = new Date();

  const activity = createMockActivityData({ appendedAt: new Date(serverTime.getTime() - 60_000) });

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 0,
      serverTime,
      verifiedHead: 0,
    })),
    mockActivityService.trackActivityProgress.handler((opts) => {
      const last = opts.input.checkpoints.at(-1);

      return { appendedHead: last?.version ?? opts.input.expectedHead };
    }),
  );

  const result = await runResync({
    // life 1 fails the first attempt fast, and the abort policy ends the fast-forward there
    avatar: createMockAvatarData({ life: 1 }),
    avatarID: activity.avatarID,
    buildActivityInput: ctx.buildActivityInput,
    client: ctx.client,
    submitter: ctx.submitter,
  });

  expect(result.plan).toMatchObject({ budgetMs: 60_000, kind: 'fast-forward' });
  expect(result.report).toMatchObject({ attempts: 1, reason: 'aborted-on-failure' });
});
