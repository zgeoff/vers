import { expect, mock, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { MAX_REVEAL_BATCH_NODES } from '@vers/contract-activity';
import { ActivityFailureAction } from '@vers/idle-core';
import { mockActivityService } from '@vers/mock-services/activity';
import invariant from 'tiny-invariant';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { server } from '../../mocks/node';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { useSeedPrefetch } from './use-seed-prefetch';

/**
 * Mounts `useSeedPrefetch` under a fresh query client, returning RTL's handle so a test can
 * `rerender` with a changed revealed-node-id set — the project `renderHook` util takes no
 * per-render props, which this hook's reactive input needs.
 */
function renderSeedPrefetch(initialNodeIDs: ReadonlySet<string>) {
  const queryClient = buildQueryClient();

  return renderHook(
    (nodeIDs: ReadonlySet<string>) => {
      useSeedPrefetch(nodeIDs);
    },
    {
      initialProps: initialNodeIDs,
      wrapper: (props: Readonly<{ children: React.ReactNode }>) => (
        <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
      ),
    },
  );
}

test('it calls revealNodes only for the delta beyond what a prior reveal already cached', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.revealNodes.handler((opts) => {
      track(opts.input);

      return opts.input.nodeIDs.map((nodeID) => ({ genesisSeed: `seed-${nodeID}`, nodeID }));
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderSeedPrefetch(new Set(['0_0']));

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({ avatarID: avatar.id, nodeIDs: ['0_0'] });
    });

    hook.rerender(new Set(['0_0', '1_0']));

    await waitFor(() => {
      expect(track).toHaveBeenCalledTimes(2);
    });

    expect(track).toHaveBeenLastCalledWith({ avatarID: avatar.id, nodeIDs: ['1_0'] });
  });
});

test('it does not repeat a reveal for a node already cached this session', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.revealNodes.handler((opts) => {
      track(opts.input);

      return opts.input.nodeIDs.map((nodeID) => ({ genesisSeed: `seed-${nodeID}`, nodeID }));
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderSeedPrefetch(new Set(['0_0', '1_0']));

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({
        avatarID: avatar.id,
        nodeIDs: ['0_0', '1_0'],
      });
    });

    // an unchanged set re-passed as the same value must not fire a second call: if it wrongly did,
    // the next assertion would see three calls instead of two
    hook.rerender(new Set(['0_0', '1_0']));
    hook.rerender(new Set(['0_0', '1_0', '2_0']));

    await waitFor(() => {
      expect(track).toHaveBeenCalledTimes(2);
    });

    expect(track).toHaveBeenLastCalledWith({ avatarID: avatar.id, nodeIDs: ['2_0'] });
  });
});

test('it chunks a delta larger than the server-side reveal batch cap', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.revealNodes.handler((opts) => {
      track(opts.input);

      return opts.input.nodeIDs.map((nodeID) => ({ genesisSeed: `seed-${nodeID}`, nodeID }));
    }),
  );

  const nodeIDs = Array.from({ length: MAX_REVEAL_BATCH_NODES + 1 }, (_, index) => `${index}_0`);

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderSeedPrefetch(new Set(nodeIDs));

    await waitFor(() => {
      expect(track).toHaveBeenCalledTimes(2);
    });

    expect(track.mock.calls[0]?.[0]).toStrictEqual({
      avatarID: avatar.id,
      nodeIDs: nodeIDs.slice(0, MAX_REVEAL_BATCH_NODES),
    });

    expect(track.mock.calls[1]?.[0]).toStrictEqual({
      avatarID: avatar.id,
      nodeIDs: nodeIDs.slice(MAX_REVEAL_BATCH_NODES),
    });
  });
});

test('it relays the seeds revealNodes returns to the worker client', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  server.use(
    mockActivityService.revealNodes.handler((opts) =>
      opts.input.nodeIDs.map((nodeID) => ({ genesisSeed: `seed-${nodeID}`, nodeID })),
    ),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderSeedPrefetch(new Set(['0_0', '1_0']));

    await waitFor(() => {
      expect(client.cacheNodeSeeds).toHaveBeenCalledExactlyOnceWith(
        {
          avatarID: avatar.id,
          seeds: [
            { genesisSeed: 'seed-0_0', nodeID: '0_0' },
            { genesisSeed: 'seed-1_0', nodeID: '1_0' },
          ],
        },
        expect.anything(),
      );
    });
  });
});

test('it does not re-request an in-flight id when the frontier grows mid-batch', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  const track = mock<(input: unknown) => void>();
  let releaseFirstReveal: (() => void) | undefined;

  server.use(
    mockActivityService.revealNodes.handler(async (opts) => {
      track(opts.input);

      // hold the first batch in flight so the frontier can grow before it resolves
      if (opts.input.nodeIDs.includes('0_0')) {
        await new Promise<void>((resolve) => {
          releaseFirstReveal = resolve;
        });
      }

      return opts.input.nodeIDs.map((nodeID) => ({ genesisSeed: `seed-${nodeID}`, nodeID }));
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderSeedPrefetch(new Set(['0_0']));

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({ avatarID: avatar.id, nodeIDs: ['0_0'] });
    });

    hook.rerender(new Set(['0_0', '1_0']));

    // the grown frontier reveals only the new id: the in-flight 0_0 stays marked, so it is never
    // re-requested while its first reveal is still pending
    await waitFor(() => {
      expect(track).toHaveBeenCalledTimes(2);
    });

    expect(track).toHaveBeenLastCalledWith({ avatarID: avatar.id, nodeIDs: ['1_0'] });

    invariant(releaseFirstReveal, 'the first reveal call registered its release gate');
    releaseFirstReveal();
  });
});
