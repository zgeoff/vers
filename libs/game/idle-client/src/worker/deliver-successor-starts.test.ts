import { expect, mock, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { writeActivityStart } from '../submission/write-activity-start';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { deliverSuccessorStarts } from './deliver-successor-starts';

test('it flushes the registered successor of the ended activity at once', async () => {
  const submitter = {
    ...createStubSubmitter(),
    collectActivityStates: mock(() => [
      {
        activityID: 'act_successor_registered',
        expectedHead: 0,
        latestQueuedVersion: 4,
        retryAttempt: 2,
        retryDelayMs: 40_000,
        state: 'retrying',
      },
    ]),
  };

  const context = createStubWorkerContext({ submitter });

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_chain',
      id: 'act_successor_registered',
      predecessorActivityID: 'act_ended',
      startKey: 'continue_act_ended',
    }),
  );

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_chain',
      id: 'act_later',
      predecessorActivityID: 'act_successor_registered',
      startKey: 'continue_act_successor_registered',
    }),
  );

  await deliverSuccessorStarts(context, 'act_ended');

  expect(submitter.flushNow).toHaveBeenCalledExactlyOnceWith('act_successor_registered');
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

test('it ingests and registers an unregistered successor of the ended activity', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  const successor = createMockActivityData({
    avatarID: 'avatar_chain',
    id: 'act_successor_unregistered',
    predecessorActivityID: 'act_ended',
    scopeID: '1_0',
    startKey: 'continue_act_ended',
  });

  await writeActivityStart(successor);

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: successor, appendedHead: 0 })),
  );

  await deliverSuccessorStarts(context, 'act_ended');

  const remaining = await readAllActivityStarts();

  expect(remaining).toStrictEqual([]);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: successor.id,
    appendedHead: 0,
    avatarID: successor.avatarID,
    lastHash: successor.startHash,
    previousNextSeed: successor.seed,
    scopeID: successor.scopeID,
    startChainIndex: successor.startChainIndex,
  });
});

test('it sends nothing when no start in the outbox follows the ended activity', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const advance = mock<(input: unknown) => void>();

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_chain',
      id: 'act_unrelated',
      predecessorActivityID: 'act_other',
      startKey: 'continue_act_other',
    }),
  );

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      advance(opts.input);
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  await deliverSuccessorStarts(context, 'act_ended');

  expect(advance).not.toHaveBeenCalled();
  expect(submitter.flushNow).not.toHaveBeenCalled();
});
