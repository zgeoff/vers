import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { runResyncFlow } from './run-resync-flow';
import type { FlowSignals } from './types';

test('it resets a held run belonging to another avatar before installing', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  // a run held for a different avatar can only arrive through the switch guard's TOCTOU gap
  context.setActivity(createMockActivityData({ avatarID: 'someone-else' }));

  const before = context.getSimulation();

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  expect(context.getActivity()).toBeNull();
  expect(context.getSimulation()).not.toBe(before);
});
