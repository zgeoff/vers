import { expect, mock, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { ClientMessage } from '@vers/idle-client';
import {
  ClientMessageType,
  WorkerMessageType,
  isRequestFlushMessage,
  isSetActivityMessage,
} from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import { http } from 'msw';
import invariant from 'tiny-invariant';
import { orpc } from '../../lib/rpc/orpc';
import { server } from '../../mocks/node';
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

test('it starts an activity for the selected node once initialized, sending the started row', async () => {
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
      expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
    });
  });

  const sent = calls.find((call) => isSetActivityMessage(call));

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  invariant(sent !== undefined, 'expected a set-activity message');
  invariant(minted !== undefined, 'expected the start to mint an active row');
  expect(sent.activity.id).toBe(minted.id);
  expect(sent.activity.scopeID).toBe('a9lp75');
});

test('it requests a resync instead of starting when the same scope is already active', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'a9lp75' });

  // a live row already owns the avatar for this same scope, so the start conflicts with it
  await db.activityCollection.create({
    avatarID: avatar.id,
    scopeID: node.id,
    scopeType: 'world_map_node',
    status: 'active',
  });

  setSelectedNode(node);

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
      expect(calls).toContainEqual({ avatarID: avatar.id, type: ClientMessageType.RequestResync });
    });

    expect(calls.some((call) => isSetActivityMessage(call))).toBeFalse();
  });
});

test('it flushes the worker before stopping a conflicting activity from a different scope', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  // a live row owns the avatar for a different scope, so the start conflicts with it and the
  // recovery path must stop that row before starting the newly selected node
  await db.activityCollection.create({
    avatarID: avatar.id,
    scopeID: 'a-different-node',
    scopeType: 'world_map_node',
    status: 'active',
  });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const stopActivityCalled = mock<() => void>();

  server.use(
    http.post(`${resolveServiceURL('activity')}/rpc/stopActivity`, () => {
      stopActivityCalled();
    }),
  );

  const channel = new MessageChannel();

  const calls: Array<ClientMessage> = [];

  channel.port2.start();

  channel.port2.addEventListener('message', (event: MessageEvent<ClientMessage>) => {
    calls.push(event.data);
  });

  const worker = { port: channel.port1 };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(calls.some((call) => isRequestFlushMessage(call))).toBeTrue();
    });

    // the stop is gated on the flush ack this test hasn't sent yet
    expect(stopActivityCalled).not.toHaveBeenCalled();

    const request = calls.find((call) => isRequestFlushMessage(call));

    invariant(request !== undefined, 'expected a request-flush message');

    channel.port2.postMessage({
      activityID: request.activityID,
      requestID: request.requestID,
      type: WorkerMessageType.FlushCompleted,
    });

    await waitFor(() => {
      expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
    });
  });

  expect(stopActivityCalled).toHaveBeenCalledOnce();

  const sent = calls.find((call) => isSetActivityMessage(call));

  invariant(sent !== undefined, 'expected a set-activity message');
  expect(sent.activity.avatarID).toBe(avatar.id);
  expect(sent.activity.scopeID).toBe('a9lp75');
});

test('it renders the node and its codex fragment once the worker reports the sent activity', async () => {
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
      expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
    });

    const sent = calls.find((call) => isSetActivityMessage(call));

    invariant(sent !== undefined, 'expected a set-activity message');

    // the worker reporting the sent activity back is one setter call — mounted components
    // re-render on it, no manual refresh
    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: sent.activity.id }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker,
    });

    const codex = await rendered.findByTestId('world-map-node-codex-stub');

    expect(codex).toBeVisible();
  });
});

test('it offers a retry instead of spinning forever when starting fails, and retries on demand', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'a9lp75' });
  const started = createMockActivityData({ avatarID: avatar.id, scopeID: node.id });
  let startCalls = 0;

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      startCalls += 1;

      if (startCalls === 1) {
        throw opts.errors.NOT_FOUND({ data: {} });
      }

      return started;
    }),
  );

  setSelectedNode(node);

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

    const retry = await rendered.findByTestId('start-activity-retry');

    await user.click(retry);

    await waitFor(() => {
      expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
    });
  });
});

test('it renders the auto-retry checkbox unchecked by default and dispatches the toggle', async () => {
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
      expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
    });

    const sent = calls.find((call) => isSetActivityMessage(call));

    invariant(sent !== undefined, 'expected a set-activity message');

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: sent.activity.id }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker,
    });

    const checkbox = await rendered.findByLabelText('Auto-retry on failure');

    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(calls).toContainEqual({
      failureAction: ActivityFailureAction.Retry,
      type: ClientMessageType.SetFailureAction,
    });
  });
});
