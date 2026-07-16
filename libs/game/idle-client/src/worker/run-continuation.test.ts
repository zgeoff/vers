import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createTestAccessToken, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { WorkerMessageType } from '../types';
import { runContinuation } from './run-continuation';

interface SetupTestConfig {
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user, so
 * continuation starts hit the same conflict/mint logic the real service applies to the rows the
 * test seeds in the mock db.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const token = await createTestAccessToken(config.userID);

  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  return { client };
}

function buildSpySubmitter(): CheckpointSubmitter {
  return {
    flushHeld: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve<number | undefined>(undefined)),
  };
}

test('it adopts a fresh server-started row for the same scope and registers from a zero cursor', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const submitter = buildSpySubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: avatar.id });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the continuation to mint an active row');
  expect(minted.scopeID).toBe(previousActivity.scopeID);
  expect(simulation.activity?.id).toBe(minted.id);
  expect(context.getActivity()).toStrictEqual(minted);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: minted.id,
    appendedHead: 0,
    lastHash: minted.startHash,
    startChainIndex: minted.startChainIndex,
  });
});

test('it adopts the CONFLICT payload row when one is already active for the scope', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const conflictingActivity = await db.activityCollection.create({
    avatarID: avatar.id,
    status: 'active',
  });

  const submitter = buildSpySubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: avatar.id });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity?.id).toBe(conflictingActivity.id);
  expect(context.getActivity()).toStrictEqual(conflictingActivity);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: conflictingActivity.id,
    appendedHead: 0,
    lastHash: conflictingActivity.startHash,
    startChainIndex: conflictingActivity.startChainIndex,
  });
});

test('it stops the simulation and broadcasts offline on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const connection = createTestConnection();
  const submitter = buildSpySubmitter();
  const context = createStubWorkerContext({ connections: [connection.port], submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity).toBeNull();
  expect(submitter.registerActivity).not.toHaveBeenCalled();

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { online: false, type: WorkerMessageType.ConnectionStatus },
  ]);
});
