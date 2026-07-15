import { expect, onTestFinished, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { setResyncStatus } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import * as db from '@vers/mock-services/db';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { GameSimulationMount } from './game-simulation-mount';

function renderMount() {
  const queryClient = buildQueryClient();

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <GameSimulationMount />
    </QueryClientProvider>,
  );

  const refreshMount = () => {
    rendered.rerender(
      <QueryClientProvider client={queryClient}>
        <GameSimulationMount />
      </QueryClientProvider>,
    );
  };

  return { refreshMount, rendered };
}

test('it sends the initialize message once a worker connects that has not reported state yet', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withIdleWorkerHandle(
    { activity: undefined, failureAction: ActivityFailureAction.Abort, initialized: false, worker },
    () => {
      renderMount();
    },
  );

  expect(calls).toStrictEqual([{ type: 'initialize' }]);
});

test('it sends nothing once the worker has already reported its state and no avatar is known', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withIdleWorkerHandle(
    { activity: undefined, failureAction: ActivityFailureAction.Abort, initialized: true, worker },
    () => {
      renderMount();
    },
  );

  expect(calls).toStrictEqual([]);
});

test('it sends nothing before a worker has connected', async () => {
  const calls: Array<unknown> = [];

  await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker: undefined,
    },
    () => {
      renderMount();
      expect(calls).toStrictEqual([]);
    },
  );
});

test('it renders without error when the worker reports a stopped checkpoint stream', async () => {
  await withIdleWorkerHandle(
    {
      activity: undefined,
      checkpointStreamError: { activityID: 'activity_1', reason: 'broken-chain-link' },
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker: undefined,
    },
    () => {
      const mount = renderMount();

      expect(mount.rendered.container).toBeEmptyDOMElement();
    },
  );
});

test('it sends initialize then requests a resync once the active avatar resolves', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        renderMount();

        await waitFor(() => {
          expect(calls).toContainEqual({ avatarID: avatar.id, type: 'request_resync' });
        });
      },
    );
  });
});

test('it never sends a resync request without a known avatar', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withRequestContext({}, () =>
    withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      () => {
        const mount = renderMount();

        mount.refreshMount();

        expect(calls).not.toContainEqual(expect.objectContaining({ type: 'request_resync' }));
      },
    ),
  );
});

test('it sends a resync request only once across re-renders', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        const mount = renderMount();

        await waitFor(() => {
          expect(calls).toContainEqual({ avatarID: avatar.id, type: 'request_resync' });
        });

        mount.refreshMount();
        mount.refreshMount();

        const resyncCalls = calls.filter(
          (call) => (call as { type: string }).type === 'request_resync',
        );

        expect(resyncCalls).toHaveLength(1);
      },
    );
  });
});

test('it resends a resync request when the browser reports coming back online', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  onTestFinished(() => {
    setResyncStatus(null);
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        renderMount();

        await waitFor(() => {
          expect(calls).toContainEqual({ avatarID: avatar.id, type: 'request_resync' });
        });

        globalThis.dispatchEvent(new Event('online'));

        await waitFor(() => {
          const resyncCalls = calls.filter(
            (call) => (call as { type: string }).type === 'request_resync',
          );

          expect(resyncCalls).toHaveLength(2);
        });
      },
    );
  });
});
