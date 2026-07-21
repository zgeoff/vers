import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { advanceWriterGeneration } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import { orpc } from '../../lib/rpc/orpc';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ExploreCurrentPanel } from './explore-current-panel';

test('it shows a spinner and calls initialize before the worker reports its state', () => {
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    writerAbortSignal: new AbortController().signal,
  });

  const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

  expect(client.initialize).toHaveBeenCalledExactlyOnceWith({}, expect.anything());
  expect(rendered.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
});

test('it re-sends the start intent against a promoted writer', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const client = createStubWorkerClient({
    startActivity: () => new Promise(() => {}),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    // a promoted writer never answers the dead writer's call; the panel re-raises its intent
    advanceWriterGeneration();

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(2);
    });
  });
});

test('it sends one start call for the selected node once initialized', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const client = createStubWorkerClient({
    startActivity: () => new Promise(() => {}),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledExactlyOnceWith(
        { avatarID: avatar.id, scopeID: 'a9lp75', scopeType: 'world_map_node' },
        expect.anything(),
      );
    });
  });
});

test('it renders the node and its codex fragment once the worker reports the start', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: 'a9lp75' });

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ activity: started, kind: 'started' }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    // the worker answering the call is one setter call — mounted components re-render on it
    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      writerAbortSignal: new AbortController().signal,
    });

    const codex = await rendered.findByTestId('world-map-node-codex-stub');

    expect(codex).toBeVisible();
  });
});

test('it treats an attached report as ready once the simulation carries that row', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ activityID: 'activity_attached', kind: 'attached' }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: 'activity_attached' }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      writerAbortSignal: new AbortController().signal,
    });

    const codex = await rendered.findByTestId('world-map-node-codex-stub');

    expect(codex).toBeVisible();
  });
});

test('it offers a retry on a failed report and sends a fresh call on demand', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ kind: 'failed' }),
  });

  const user = userEvent.setup();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    const retry = await rendered.findByTestId('start-activity-retry');

    expect(client.startActivity).toHaveBeenCalledTimes(1);

    await user.click(retry);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(2);
    });
  });
});

test('it renders the auto-retry checkbox unchecked by default and dispatches the toggle', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: 'a9lp75' });

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ activity: started, kind: 'started' }),
  });

  const user = userEvent.setup();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      writerAbortSignal: new AbortController().signal,
    });

    const checkbox = await rendered.findByLabelText('Auto-retry on failure');

    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(client.setFailureAction).toHaveBeenCalledExactlyOnceWith(
      { avatarID: avatar.id, failureAction: ActivityFailureAction.Retry },
      expect.anything(),
    );
  });
});
