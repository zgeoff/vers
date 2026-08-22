import { expect, mock, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { MAX_REVEAL_BATCH_NODES } from '@vers/contract-activity';
import { ActivityFailureAction } from '@vers/idle-core';
import { mockActivityService } from '@vers/mock-services/activity';
import invariant from 'tiny-invariant';
import { server } from '../../mocks/node';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { renderHook } from '../../test-utils/render-hook';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { useSeedPrefetch } from './use-seed-prefetch';

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

      return {
        keyVersion: 1,
        nodes: opts.input.nodeIDs.map((nodeID) => ({
          contentVersion: '2',
          encounterNode: { difficulty: 1 },
          genesisSeed: `seed-${nodeID}`,
          anchor: { chainIndex: 0, nextSeed: `seed-${nodeID}` },
          nodeID,
        })),
        secretRef: 'worldmap',
        secretVersion: 1,
      };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    let revealed: ReadonlySet<string> = new Set(['0_0']);

    const hook = renderHook(() => {
      useSeedPrefetch(revealed);
    });

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({ avatarID: avatar.id, nodeIDs: ['0_0'] });
    });

    revealed = new Set(['0_0', '1_0']);

    hook.rerender();

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

      return {
        keyVersion: 1,
        nodes: opts.input.nodeIDs.map((nodeID) => ({
          contentVersion: '2',
          encounterNode: { difficulty: 1 },
          genesisSeed: `seed-${nodeID}`,
          anchor: { chainIndex: 0, nextSeed: `seed-${nodeID}` },
          nodeID,
        })),
        secretRef: 'worldmap',
        secretVersion: 1,
      };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    let revealed: ReadonlySet<string> = new Set(['0_0', '1_0']);

    const hook = renderHook(() => {
      useSeedPrefetch(revealed);
    });

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({
        avatarID: avatar.id,
        nodeIDs: ['0_0', '1_0'],
      });
    });

    // an unchanged set re-passed as the same value must not fire a second call: if it wrongly did,
    // the next assertion would see three calls instead of two
    revealed = new Set(['0_0', '1_0']);

    hook.rerender();

    revealed = new Set(['0_0', '1_0', '2_0']);

    hook.rerender();

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

      return {
        keyVersion: 1,
        nodes: opts.input.nodeIDs.map((nodeID) => ({
          contentVersion: '2',
          encounterNode: { difficulty: 1 },
          genesisSeed: `seed-${nodeID}`,
          anchor: { chainIndex: 0, nextSeed: `seed-${nodeID}` },
          nodeID,
        })),
        secretRef: 'worldmap',
        secretVersion: 1,
      };
    }),
  );

  const nodeIDs = Array.from({ length: MAX_REVEAL_BATCH_NODES + 1 }, (_, index) => `${index}_0`);

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const revealed: ReadonlySet<string> = new Set(nodeIDs);

    renderHook(() => {
      useSeedPrefetch(revealed);
    });

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

test('it relays the seeds and stamps revealNodes returns to the worker client', async () => {
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
    mockActivityService.revealNodes.handler((opts) => ({
      keyVersion: 1,
      nodes: opts.input.nodeIDs.map((nodeID) => ({
        contentVersion: '2',
        encounterNode: { difficulty: 1 },
        genesisSeed: `seed-${nodeID}`,
        anchor: { chainIndex: 0, nextSeed: `seed-${nodeID}` },
        nodeID,
      })),
      secretRef: 'worldmap',
      secretVersion: 1,
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const revealed: ReadonlySet<string> = new Set(['0_0', '1_0']);

    renderHook(() => {
      useSeedPrefetch(revealed);
    });

    await waitFor(() => {
      expect(client.cacheNodeSeeds).toHaveBeenCalledExactlyOnceWith(
        {
          avatarID: avatar.id,
          seeds: [
            {
              contentVersion: '2',
              encounterNode: { difficulty: 1 },
              genesisSeed: 'seed-0_0',
              anchor: { chainIndex: 0, nextSeed: 'seed-0_0' },
              nodeID: '0_0',
            },
            {
              contentVersion: '2',
              encounterNode: { difficulty: 1 },
              genesisSeed: 'seed-1_0',
              anchor: { chainIndex: 0, nextSeed: 'seed-1_0' },
              nodeID: '1_0',
            },
          ],
          stamps: { keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 },
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

      return {
        keyVersion: 1,
        nodes: opts.input.nodeIDs.map((nodeID) => ({
          contentVersion: '2',
          encounterNode: { difficulty: 1 },
          genesisSeed: `seed-${nodeID}`,
          anchor: { chainIndex: 0, nextSeed: `seed-${nodeID}` },
          nodeID,
        })),
        secretRef: 'worldmap',
        secretVersion: 1,
      };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    let revealed: ReadonlySet<string> = new Set(['0_0']);

    const hook = renderHook(() => {
      useSeedPrefetch(revealed);
    });

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({ avatarID: avatar.id, nodeIDs: ['0_0'] });
    });

    revealed = new Set(['0_0', '1_0']);

    hook.rerender();

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

test('it completes an in-flight reveal batch the frontier growth overlaps, caching its seeds', async () => {
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

  const track = mock<(input: unknown) => void>();
  let releaseFirstReveal: (() => void) | undefined;

  server.use(
    mockActivityService.revealNodes.handler(async (opts) => {
      track(opts.input);

      // hold the first batch in flight so the frontier grows while it is still pending
      if (opts.input.nodeIDs.includes('0_0')) {
        await new Promise<void>((resolve) => {
          releaseFirstReveal = resolve;
        });
      }

      return {
        keyVersion: 1,
        nodes: opts.input.nodeIDs.map((nodeID) => ({
          contentVersion: '2',
          encounterNode: { difficulty: 1 },
          genesisSeed: `seed-${nodeID}`,
          anchor: { chainIndex: 0, nextSeed: `seed-${nodeID}` },
          nodeID,
        })),
        secretRef: 'worldmap',
        secretVersion: 1,
      };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    let revealed: ReadonlySet<string> = new Set(['0_0']);

    const hook = renderHook(() => {
      useSeedPrefetch(revealed);
    });

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({ avatarID: avatar.id, nodeIDs: ['0_0'] });
    });

    revealed = new Set(['0_0', '1_0']);

    hook.rerender();

    // the frontier growth fires the new id while the first batch is still held in flight
    await waitFor(() => {
      expect(track).toHaveBeenCalledTimes(2);
    });

    invariant(releaseFirstReveal, 'the first reveal call registered its release gate');
    releaseFirstReveal();

    // the frontier growth did not abort the still-pending first batch: once released it completes
    // and caches its own seed rather than being cancelled
    await waitFor(() => {
      expect(client.cacheNodeSeeds).toHaveBeenCalledWith(
        {
          avatarID: avatar.id,
          seeds: [
            {
              contentVersion: '2',
              encounterNode: { difficulty: 1 },
              genesisSeed: 'seed-0_0',
              anchor: { chainIndex: 0, nextSeed: 'seed-0_0' },
              nodeID: '0_0',
            },
          ],
          stamps: { keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 },
        },
        expect.anything(),
      );
    });
  });
});
