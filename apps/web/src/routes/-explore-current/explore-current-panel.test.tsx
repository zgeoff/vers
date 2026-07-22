import { expect, mock, spyOn, test } from 'bun:test';
import { useRouter } from '@tanstack/react-router';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { StartStatus } from '@vers/idle-client';
import { advanceWriterGeneration } from '@vers/idle-client';
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

/**
 * Captures the router instance a `renderWithRouter` tree mounts under, so a test can spy on its
 * `navigate` method — router-aware primitives only ever expose this instance through hooks.
 */
let latestRouter: ReturnType<typeof useRouter> | undefined;

function NavigationProbe() {
  latestRouter = useRouter();

  return null;
}

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

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

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
        { avatarID: avatar.id, scopeID: 'a9lp75', scopeType: 'world_map_node' },
        { signal: writerAbortSignal },
      );
    });
  });
});

test('it renders the node and its codex fragment once the worker reports the start', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

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
    const rendered = renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    // the navigate this readiness triggers is not this test's concern — stubbed so the panel
    // stays mounted and its codex assertion below reads this attempt's own outcome
    spyOn(latestRouter, 'navigate').mockImplementation(() => Promise.resolve());

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

  await createActiveAvatar({ userID: signedIn.userID });

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
    const rendered = renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    // the navigate this readiness triggers is not this test's concern — stubbed so the panel
    // stays mounted and its codex assertion below reads this attempt's own outcome
    spyOn(latestRouter, 'navigate').mockImplementation(() => Promise.resolve());

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

  await createActiveAvatar({ userID: signedIn.userID });

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

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: 'a9lp75' });

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
    const rendered = renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    // the navigate this readiness triggers is not this test's concern — stubbed so the panel
    // stays mounted for the checkbox interaction below
    spyOn(latestRouter, 'navigate').mockImplementation(() => Promise.resolve());

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    setIdleWorkerHandle({
      activity: createMockActivitySnapshot({ id: started.id }),
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
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
    renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    const navigateSpy = spyOn(latestRouter, 'navigate').mockImplementation(() => Promise.resolve());

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

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ to: '/activity' }),
      );
    });
  });
});

test('it navigates once an attached report is ready, without a fresh start call', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

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
    renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    const navigateSpy = spyOn(latestRouter, 'navigate').mockImplementation(() => Promise.resolve());

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

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ to: '/activity' }),
      );
    });
  });
});

test('it does not navigate when the start attempt fails', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

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
    const rendered = renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    const navigateSpy = spyOn(latestRouter, 'navigate').mockImplementation(() => Promise.resolve());

    await rendered.findByTestId('start-activity-retry');

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

test('it does not re-navigate for the same attempt once a ready state flickers', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

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
    const rendered = renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    const navigateSpy = spyOn(latestRouter, 'navigate').mockImplementation(() => Promise.resolve());

    await waitFor(() => {
      expect(client.startActivity).toHaveBeenCalledTimes(1);
    });

    const readySnapshot = createMockActivitySnapshot({ id: started.id });

    setIdleWorkerHandle({
      activity: readySnapshot,
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      writerAbortSignal: new AbortController().signal,
    });

    await rendered.findByLabelText('Auto-retry on failure');

    expect(navigateSpy).toHaveBeenCalledTimes(1);

    // a resync blip clears the store's activity, then restores the exact same one — the same
    // attempt, never a fresh one — and must not re-fire the navigate the first ready state sent
    setIdleWorkerHandle({
      activity: undefined,
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      writerAbortSignal: new AbortController().signal,
    });

    await waitFor(() => {
      expect(rendered.queryByLabelText('Auto-retry on failure')).not.toBeInTheDocument();
    });

    setIdleWorkerHandle({
      activity: readySnapshot,
      client,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      writerAbortSignal: new AbortController().signal,
    });

    await rendered.findByLabelText('Auto-retry on failure');

    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });
});

test('it does not bounce back to the engagement screen once a remount finds the same activity already live', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'a9lp75' }));

  const started = createMockActivityData({ avatarID: avatar.id, scopeID: 'a9lp75' });

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
    renderWithRouter(
      <>
        <ExploreCurrentPanel orpc={orpc} />
        <NavigationProbe />
      </>,
    );

    await waitFor(() => {
      expect(latestRouter).toBeDefined();
    });

    invariant(latestRouter !== undefined, 'expected the navigation probe to capture the router');

    // real navigation this time — not stubbed — so every route change below actually unmounts and
    // remounts the panel, the path a stubbed navigate would never exercise. The synthetic route
    // tree renders this same panel at both '/' and '/activity', so arriving at '/activity' is
    // itself already a remount finding the activity attached — the first place the fix is proven.
    const router = latestRouter;
    const navigateSpy = spyOn(router, 'navigate');

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

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ to: '/activity' }),
      );
    });

    // the panel's own auto-navigate call is proven above — restoring here so the manual return
    // below (standing in for the browser back button) never counts toward it
    navigateSpy.mockRestore();

    // returning to the explore screen mid-run remounts the panel, which re-fires its start call
    // and finds the same activity already attached
    await router.navigate({ to: '/' });

    const returnNavigateSpy = spyOn(router, 'navigate');

    await waitFor(() => {
      expect(startActivity.mock.calls.length).toBeGreaterThan(1);
    });

    // gives the remounted panel's readiness effect a chance to fire before asserting it never did
    await expect(
      waitFor(
        () => {
          expect(returnNavigateSpy).toHaveBeenCalled();
        },
        { timeout: 100 },
      ),
    ).toReject();

    expect(returnNavigateSpy).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/');
  });
});
