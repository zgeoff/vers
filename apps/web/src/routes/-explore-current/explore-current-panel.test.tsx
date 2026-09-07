import { expect, mock, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { StartStatus } from '@vers/idle-client';
import { advanceWriterGeneration, setEngagedRun, setResyncStatus } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import invariant from 'tiny-invariant';
import { orpc } from '../../lib/rpc/orpc';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ExploreCurrentPanel } from './explore-current-panel';

test('it shows a spinner and calls initialize before the worker reports its state', async () => {
  const client = createStubWorkerClient();

  const writerAbortSignal = new AbortController().signal;

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    writerAbortSignal,
  });

  const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

  await waitFor(() => {
    expect(client.initialize).toHaveBeenCalledExactlyOnceWith({}, { signal: writerAbortSignal });
  });

  expect(rendered.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
});

test('it re-sends the start intent against a promoted writer', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

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
    renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

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
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const client = createStubWorkerClient({
    startActivity: () => new Promise(() => {}),
  });

  const writerAbortSignal = new AbortController().signal;

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledExactlyOnceWith(
        { avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' },
        { signal: writerAbortSignal },
      );
    });
  });
});

test('it withholds the start call while an offline catch-up is fast-forwarding', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));
  setResyncStatus({ attempts: 3, kind: 'fast-forwarding', levelUps: 0 });

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ kind: 'failed' }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    // a start that went out would resolve to `failed` and render the retry action — its absence
    // within a generous window stands in for the call never having been sent
    await expect(
      rendered.findByTestId('start-activity-retry', undefined, { timeout: 300 }),
    ).toReject();

    expect(client.startActivity).not.toHaveBeenCalled();
  });
});

test('it sends the start once the offline catch-up clears', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));
  setResyncStatus({ attempts: 3, kind: 'fast-forwarding', levelUps: 0 });

  const client = createStubWorkerClient({
    startActivity: () => new Promise(() => {}),
  });

  const writerAbortSignal = new AbortController().signal;

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);
    setResyncStatus(null);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledExactlyOnceWith(
        { avatarID: avatar.id, scopeID: 'a9lp75', scopeType: 'world_map_node' },
        { signal: writerAbortSignal },
      );
    });
  });
});

test('it renders the node and its codex fragment once the worker reports the start', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: '0_0' });

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
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    // the panel navigates once a fresh start engages; latching it already-engaged keeps the panel
    // mounted here so this test reads the ready-state content in place
    setEngagedRun({
      avatarID: avatar.id,
      id: started.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    });

    // the worker answering the call is one setter call — mounted components re-render on it
    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      liveRun: { avatarID: avatar.id, id: started.id, scopeID: '0_0', scopeType: 'world_map_node' },
      writerAbortSignal: new AbortController().signal,
    });

    const codex = await rendered.findByTestId('world-map-node-codex-stub');

    expect(codex).toBeVisible();
  });
});

test('it treats an attached report as ready once the simulation carries that row', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

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
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    // the panel navigates once a fresh start engages; latching it already-engaged keeps the panel
    // mounted here so this test reads the ready-state content in place
    setEngagedRun({
      avatarID: avatar.id,
      id: 'activity_attached',
      scopeID: '0_0',
      scopeType: 'world_map_node',
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: 'activity_attached' }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      liveRun: {
        avatarID: avatar.id,
        id: 'activity_attached',
        scopeID: '0_0',
        scopeType: 'world_map_node',
      },
      writerAbortSignal: new AbortController().signal,
    });

    const codex = await rendered.findByTestId('world-map-node-codex-stub');

    expect(codex).toBeVisible();
  });
});

test('it offers a retry on a failed report and sends a fresh call on demand', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

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
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

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
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: '0_0' });

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ activity: started, kind: 'started' }),
  });

  const user = userEvent.setup();

  const writerAbortSignal = new AbortController().signal;

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    // the panel navigates once a fresh start engages; latching it already-engaged keeps the panel
    // mounted here so this test reads the ready-state content in place
    setEngagedRun({
      avatarID: avatar.id,
      id: started.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      liveRun: { avatarID: avatar.id, id: started.id, scopeID: '0_0', scopeType: 'world_map_node' },
      writerAbortSignal,
    });

    const checkbox = await rendered.findByLabelText('Auto-retry on failure');

    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(client.setFailureAction).toHaveBeenCalledExactlyOnceWith(
      { avatarID: avatar.id, failureAction: ActivityFailureAction.Retry },
      { signal: writerAbortSignal },
    );
  });
});

test('it ignores a start reply for a node the selection has left behind', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'node-a' }));

  const startResolvers: Array<(status: StartStatus) => void> = [];

  const client = createStubWorkerClient({
    startActivity: () =>
      new Promise((resolve) => {
        startResolvers.push(resolve);
      }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setSelectedNode(createMockWorldMapNode({ id: 'node-b' }));

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(2);
    });

    const [staleResolve] = startResolvers;

    invariant(staleResolve !== undefined, 'expected the first start call to be captured');

    // the first node's failed reply lands only after the selection moved on — it must not render
    // as the new node's outcome
    staleResolve({ kind: 'failed' });

    await expect(
      rendered.findByTestId('start-activity-retry', undefined, { timeout: 100 }),
    ).toReject();
  });
});

test('it navigates to the engagement screen once the start goes live', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: '0_0' });

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
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />, {
      routes: { '/activity': <div data-testid="engagement-screen" /> },
    });

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      liveRun: { avatarID: avatar.id, id: started.id, scopeID: '0_0', scopeType: 'world_map_node' },
      writerAbortSignal: new AbortController().signal,
    });

    await waitFor(() => {
      expect(rendered.router.state.location.pathname).toBe('/activity');
    });

    const engagementScreen = await rendered.findByTestId('engagement-screen');

    expect(engagementScreen).toBeVisible();
  });
});

test('it navigates once an attached report is ready, without a fresh start call', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

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
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />, {
      routes: { '/activity': <div data-testid="engagement-screen" /> },
    });

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: 'activity_attached' }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      liveRun: {
        avatarID: avatar.id,
        id: 'activity_attached',
        scopeID: '0_0',
        scopeType: 'world_map_node',
      },
      writerAbortSignal: new AbortController().signal,
    });

    await waitFor(() => {
      expect(rendered.router.state.location.pathname).toBe('/activity');
    });

    // the attached branch reuses the running row — navigating away never mints a fresh start
    expect(client.startActivity).toHaveBeenCalledTimes(1);
  });
});

test('it does not navigate when the start attempt fails', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ kind: 'failed' }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />, {
      routes: { '/activity': <div data-testid="engagement-screen" /> },
    });

    // the retry action rendering is the failed start fully settled — the readiness effect has run
    await rendered.findByTestId('start-activity-retry');

    expect(rendered.router.state.location.pathname).toBe('/');
  });
});

test('it does not bounce back to the engagement screen once a remount finds the same activity already live', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: '0_0' });

  // the scope never changes across this test's remounts, so every call after the first attaches to
  // the same already-running row rather than minting a fresh one
  const startActivity = mock(() =>
    startActivity.mock.calls.length === 1
      ? Promise.resolve<StartStatus>({ activity: started, kind: 'started' })
      : Promise.resolve<StartStatus>({ activityID: started.id, kind: 'attached' }),
  );

  const client = createStubWorkerClient({ startActivity });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />, {
      routes: { '/activity': <div data-testid="engagement-screen" /> },
    });

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      liveRun: { avatarID: avatar.id, id: started.id, scopeID: '0_0', scopeType: 'world_map_node' },
      writerAbortSignal: new AbortController().signal,
    });

    // the first ready state engages this attempt and navigates to the engagement screen
    await waitFor(() => {
      expect(rendered.router.state.location.pathname).toBe('/activity');
    });

    // returning mid-run remounts the panel, which re-fires its start call and finds the same
    // activity attached. Observed through the rendered outcome, not navigate's own promise: that
    // promise settles only once the router goes idle, which a superseding transition can starve.
    void rendered.router.navigate({ to: '/' });

    await waitFor(() => {
      expect(startActivity.mock.calls.length).toBeGreaterThan(1);
    });

    // gives the remounted panel's readiness effect a chance to fire before asserting it never
    // sent the player back to the engagement screen
    await expect(
      waitFor(
        () => {
          expect(rendered.router.state.location.pathname).toBe('/activity');
        },
        { timeout: 100 },
      ),
    ).toReject();

    expect(rendered.router.state.location.pathname).toBe('/');
  });
});

test('it stays rendered once auto-retry chains a continuation of the expected run', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: '0_0' });

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ activity: started, kind: 'started' }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Retry,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    // the panel navigates once a fresh start engages; latching it already-engaged keeps the panel
    // mounted here so this test reads the ready-state content in place
    setEngagedRun({
      avatarID: avatar.id,
      id: started.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Retry,
      initialized: true,
      liveRun: { avatarID: avatar.id, id: started.id, scopeID: '0_0', scopeType: 'world_map_node' },
      writerAbortSignal: new AbortController().signal,
    });

    await rendered.findByLabelText('Auto-retry on failure');

    // the failed run's continuation installs under a fresh id at the same node and avatar
    const continuation = createMockActivityData({
      avatarID: avatar.id,
      predecessorActivityID: started.id,
      scopeID: '0_0',
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: continuation.id }),
      client,
      failureAction: ActivityFailureAction.Retry,
      initialized: true,
      liveRun: {
        avatarID: avatar.id,
        id: continuation.id,
        scopeID: '0_0',
        scopeType: 'world_map_node',
      },
      writerAbortSignal: new AbortController().signal,
    });

    const checkbox = await rendered.findByLabelText('Auto-retry on failure');

    expect(checkbox).toBeChecked();
    expect(rendered.getByTestId('world-map-node-codex-stub')).toBeVisible();
  });
});

test('it waits while the live run belongs to another node', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: '0_0' });

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ activity: started, kind: 'started' }),
  });

  setIdleWorkerHandle({
    activity: createMockActivitySnapshot({ id: 'activity_elsewhere' }),
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    liveRun: {
      avatarID: avatar.id,
      id: 'activity_elsewhere',
      scopeID: '1_0',
      scopeType: 'world_map_node',
    },
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />);

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    // the start reply has settled by now, so ready-state content within this window would mean the
    // other node's run was read as this node's
    await expect(
      rendered.findByTestId('world-map-node-codex-stub', undefined, { timeout: 100 }),
    ).toReject();
  });
});

test('it does not bounce back to the engagement screen once a remount finds a continuation live', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: '0_0' });

  const continuation = createMockActivityData({
    avatarID: avatar.id,
    predecessorActivityID: started.id,
    scopeID: '0_0',
  });

  // the chain has moved on by the remount, so the re-fired start attaches to the continuation
  const startActivity = mock(() =>
    startActivity.mock.calls.length === 1
      ? Promise.resolve<StartStatus>({ activity: started, kind: 'started' })
      : Promise.resolve<StartStatus>({ activityID: continuation.id, kind: 'attached' }),
  );

  const client = createStubWorkerClient({ startActivity });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Retry,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />, {
      routes: { '/activity': <div data-testid="engagement-screen" /> },
    });

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Retry,
      initialized: true,
      liveRun: { avatarID: avatar.id, id: started.id, scopeID: '0_0', scopeType: 'world_map_node' },
      writerAbortSignal: new AbortController().signal,
    });

    await waitFor(() => {
      expect(rendered.router.state.location.pathname).toBe('/activity');
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: continuation.id }),
      client,
      failureAction: ActivityFailureAction.Retry,
      initialized: true,
      liveRun: {
        avatarID: avatar.id,
        id: continuation.id,
        scopeID: '0_0',
        scopeType: 'world_map_node',
      },
      writerAbortSignal: new AbortController().signal,
    });

    void rendered.router.navigate({ to: '/' });

    await waitFor(() => {
      expect(startActivity.mock.calls.length).toBeGreaterThan(1);
    });

    // the remounted panel reads the continuation as the run the player already engaged: it renders
    // in place rather than sending them back to the engagement screen
    const checkbox = await rendered.findByLabelText('Auto-retry on failure');

    expect(checkbox).toBeChecked();
    expect(rendered.router.state.location.pathname).toBe('/');
  });
});

test('it navigates once an attached run is live at a node other than the engaged one', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: '0_0' }));

  // the player engaged a run at a neighbouring node; the run live here was started elsewhere
  setEngagedRun({
    avatarID: avatar.id,
    id: 'activity_1_0',
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  const client = createStubWorkerClient({
    startActivity: () => Promise.resolve({ activityID: 'activity_0_0', kind: 'attached' }),
  });

  setIdleWorkerHandle({
    activity: createMockActivitySnapshot({ id: 'activity_0_0' }),
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    liveRun: {
      avatarID: avatar.id,
      id: 'activity_0_0',
      scopeID: '0_0',
      scopeType: 'world_map_node',
    },
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ExploreCurrentPanel orpc={orpc} />, {
      routes: { '/activity': <div data-testid="engagement-screen" /> },
    });

    await waitFor(() => {
      expect(rendered.router.state.location.pathname).toBe('/activity');
    });
  });
});
