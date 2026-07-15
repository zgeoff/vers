import { expect, onTestFinished, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { removeSharedWorker } from '../../test-utils/remove-shared-worker';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ExploreCurrentPanel } from './explore-current-panel';

interface SetActivityMessage {
  readonly activity: { readonly id: string };
  readonly type: 'set_activity';
}

function isSetActivityMessage(value: unknown): value is SetActivityMessage {
  return (
    typeof value === 'object' && value !== null && 'type' in value && value.type === 'set_activity'
  );
}

function renderPanel() {
  const queryClient = buildQueryClient();

  const buildUI = () => (
    <QueryClientProvider client={queryClient}>
      <ExploreCurrentPanel />
    </QueryClientProvider>
  );

  const rendered = render(buildUI());

  const refreshPanel = () => {
    rendered.rerender(buildUI());
  };

  return { refreshPanel, rendered };
}

test('it shows a spinner and sends initialize before the worker reports its state', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  setSelectedNode(null);

  await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker,
    },
    () => {
      renderPanel();
    },
  );

  expect(calls).toStrictEqual([{ type: 'initialize' }]);
  expect(screen.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
});

test('it reports the simulation as unavailable when SharedWorker is unsupported', async () => {
  setSelectedNode(null);
  removeSharedWorker();

  await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker: undefined,
    },
    () => {
      renderPanel();
    },
  );

  expect(screen.getByRole('status')).toHaveTextContent(/activity simulation is unavailable/i);
});

test('it starts an activity for the selected node once initialized, sending the started row', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'node_1' });
  const started = createMockActivityData({ avatarID: avatar.id, scopeID: node.id });

  server.use(mockActivityService.startActivity.handler(() => started));

  onTestFinished(() => {
    setSelectedNode(null);
  });

  setSelectedNode(node);

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
        renderPanel();

        await waitFor(() => {
          expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
        });

        const [sentMessage] = calls;

        if (!isSetActivityMessage(sentMessage)) {
          throw new Error('expected a set-activity message');
        }

        expect(sentMessage.activity.id).toBe(started.id);
      },
    );
  });
});

test('it requests a resync instead of starting when the same scope is already active', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'node_1' });
  const alreadyActive = createMockActivityData({ avatarID: avatar.id, scopeID: node.id });

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CONFLICT({ data: { activity: alreadyActive } });
    }),
  );

  onTestFinished(() => {
    setSelectedNode(null);
  });

  setSelectedNode(node);

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
        renderPanel();

        await waitFor(() => {
          expect(calls).toContainEqual({ avatarID: avatar.id, type: 'request_resync' });
        });

        expect(calls.some((call) => isSetActivityMessage(call))).toBeFalse();
      },
    );
  });
});

test('it renders the node and its codex fragment once the worker reports the sent activity', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'node_1' });
  const started = createMockActivityData({ avatarID: avatar.id, scopeID: node.id });

  server.use(mockActivityService.startActivity.handler(() => started));

  onTestFinished(() => {
    setSelectedNode(null);
  });

  setSelectedNode(node);

  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    let refreshPanel: (() => void) | undefined;

    await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        refreshPanel = renderPanel().refreshPanel;

        await waitFor(() => {
          expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
        });
      },
    );

    await withIdleWorkerHandle(
      {
        activity: createMockActivitySnapshot({ id: started.id }),
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        refreshPanel?.();

        const codex = await screen.findByTestId('world-map-node-codex-stub');

        expect(codex).toBeVisible();
      },
    );
  });
});

test('it offers a retry instead of spinning forever when starting fails, and retries on demand', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'node_1' });
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

  onTestFinished(() => {
    setSelectedNode(null);
  });

  setSelectedNode(node);

  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };
  const user = userEvent.setup();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        renderPanel();

        const retry = await screen.findByTestId('start-activity-retry');

        await user.click(retry);

        await waitFor(() => {
          expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
        });
      },
    );
  });
});

test('it renders the auto-retry checkbox unchecked by default and dispatches the toggle', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'node_1' });
  const started = createMockActivityData({ avatarID: avatar.id, scopeID: node.id });

  server.use(mockActivityService.startActivity.handler(() => started));

  onTestFinished(() => {
    setSelectedNode(null);
  });

  setSelectedNode(node);

  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };
  const user = userEvent.setup();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: createMockActivitySnapshot({ id: started.id }),
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        renderPanel();

        const checkbox = await screen.findByLabelText('Auto-retry on failure');

        expect(checkbox).not.toBeChecked();

        await user.click(checkbox);

        expect(calls).toContainEqual({
          failureAction: ActivityFailureAction.Retry,
          type: 'set_failure_action',
        });
      },
    );
  });
});
