import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { ClientMessage, StartActivityMessage } from '@vers/idle-client';
import { ClientMessageType, isStartActivityMessage } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import invariant from 'tiny-invariant';
import { orpc } from '../../lib/rpc/orpc';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { removeSharedWorker } from '../../test-utils/remove-shared-worker';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ExploreCurrentPanel } from './explore-current-panel';

test('it shows a spinner and sends initialize before the worker reports its state', () => {
  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    worker,
  });

  const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

  expect(calls).toStrictEqual([{ type: ClientMessageType.Initialize }]);
  expect(rendered.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
});

test('it reports the simulation as unavailable when SharedWorker is unsupported', () => {
  removeSharedWorker();

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    worker: undefined,
  });

  const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

  expect(rendered.getByRole('status')).toHaveTextContent(/activity simulation is unavailable/i);
});

test('it sends one start intent for the selected node once initialized', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls).toStrictEqual([
        {
          avatarID: avatar.id,
          requestID: expect.toBeString(),
          scopeID: 'a9lp75',
          scopeType: 'world_map_node',
          type: ClientMessageType.StartActivity,
        },
      ]);
    });
  });
});

test('it renders the node and its codex fragment once the worker reports the start', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls.some((call) => isStartActivityMessage(call))).toBeTrue();
    });

    const sent = findStartIntent(calls);
    const started = createMockActivityData({ avatarID: avatar.id, scopeID: 'a9lp75' });

    // the worker answering the intent is one setter call — mounted components re-render on it
    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      startReport: {
        requestID: sent.requestID,
        status: { activity: started, kind: 'started' },
      },
      worker,
    });

    const codex = await rendered.findByTestId('world-map-node-codex-stub');

    expect(codex).toBeVisible();
  });
});

test('it treats an attached report as ready once the simulation carries that row', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls.some((call) => isStartActivityMessage(call))).toBeTrue();
    });

    const sent = findStartIntent(calls);

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: 'activity_attached' }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      startReport: {
        requestID: sent.requestID,
        status: { activityID: 'activity_attached', kind: 'attached' },
      },
      worker,
    });

    const codex = await rendered.findByTestId('world-map-node-codex-stub');

    expect(codex).toBeVisible();
  });
});

test('it ignores a start report answering another request', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls.some((call) => isStartActivityMessage(call))).toBeTrue();
    });

    setIdleWorkerHandle({
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      startReport: { requestID: 'someone-elses-request', status: { kind: 'failed' } },
      worker,
    });

    expect(rendered.queryByTestId('start-activity-retry')).not.toBeInTheDocument();
    expect(rendered.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
  });
});

test('it offers a retry on a failed report and sends a fresh intent on demand', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };
  const user = userEvent.setup();

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls.some((call) => isStartActivityMessage(call))).toBeTrue();
    });

    const first = findStartIntent(calls);

    setIdleWorkerHandle({
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      startReport: { requestID: first.requestID, status: { kind: 'failed' } },
      worker,
    });

    const retry = await rendered.findByTestId('start-activity-retry');

    await user.click(retry);

    await waitFor(() => {
      expect(calls.filter((call) => isStartActivityMessage(call))).toHaveLength(2);
    });

    const [, second] = calls.filter((call) => isStartActivityMessage(call));

    invariant(second !== undefined, 'expected a second start intent');
    expect(second.requestID).not.toBe(first.requestID);
  });
});

test('it renders the auto-retry checkbox unchecked by default and dispatches the toggle', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };
  const user = userEvent.setup();

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls.some((call) => isStartActivityMessage(call))).toBeTrue();
    });

    const sent = findStartIntent(calls);
    const started = createMockActivityData({ avatarID: avatar.id, scopeID: 'a9lp75' });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      startReport: {
        requestID: sent.requestID,
        status: { activity: started, kind: 'started' },
      },
      worker,
    });

    const checkbox = await rendered.findByLabelText('Auto-retry on failure');

    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(calls).toContainEqual({
      avatarID: avatar.id,
      failureAction: ActivityFailureAction.Retry,
      type: ClientMessageType.SetFailureAction,
    });
  });
});

function findStartIntent(calls: ReadonlyArray<ClientMessage>): StartActivityMessage {
  const sent = calls.find((call) => isStartActivityMessage(call));

  invariant(sent !== undefined, 'expected a start intent');

  return sent;
}

test('it keeps its own outcome when a later report answers another tab', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls.some((call) => isStartActivityMessage(call))).toBeTrue();
    });

    const sent = findStartIntent(calls);
    const started = createMockActivityData({ avatarID: avatar.id, scopeID: 'a9lp75' });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      startReport: {
        requestID: sent.requestID,
        status: { activity: started, kind: 'started' },
      },
      worker,
    });

    await rendered.findByTestId('world-map-node-codex-stub');

    // another tab's broadcast replaces the shared slot — this tab already latched its own outcome
    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      startReport: { requestID: 'another-tabs-request', status: { kind: 'failed' } },
      worker,
    });

    expect(rendered.getByTestId('world-map-node-codex-stub')).toBeVisible();
    expect(rendered.queryByTestId('start-activity-retry')).not.toBeInTheDocument();
  });
});
