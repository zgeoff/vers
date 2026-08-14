import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import * as db from '@vers/mock-services/db';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { handleSetActivityMessage } from './handle-set-activity-message';

test('it starts the activity on the simulation', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();

  context.setSimulation(simulation);

  await db.contentDocumentCollection.create({});

  const activity = createMockActivityData();

  await handleSetActivityMessage(context, { activity });

  expect(simulation.activity?.id).toBe(activity.id);
});

test('it registers the row against the submitter, seeded from its own chain-link fields', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  context.setSimulation(createSimulation());

  await db.contentDocumentCollection.create({});

  const activity = createMockActivityData({
    appendedHead: 2,
    avatarID: 'avatar_1',
    id: 'activity_1',
    lastHash: 'head_hash',
    scopeID: '0_0',
    startChainIndex: 3,
  });

  await handleSetActivityMessage(context, { activity });

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: 'activity_1',
    appendedHead: 2,
    avatarID: 'avatar_1',
    lastHash: 'head_hash',
    scopeID: '0_0',
    startChainIndex: 3,
  });
});

test('it remembers the row as the live simulation source', async () => {
  const context = createStubWorkerContext();

  context.setSimulation(createSimulation());

  await db.contentDocumentCollection.create({});

  const activity = createMockActivityData();

  await handleSetActivityMessage(context, { activity });

  expect(context.getActivity()).toStrictEqual(activity);
});
