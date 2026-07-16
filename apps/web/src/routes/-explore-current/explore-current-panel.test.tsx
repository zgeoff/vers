import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { ClientMessage } from '@vers/idle-client';
import { ClientMessageType, isSetActivityMessage } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import invariant from 'tiny-invariant';
import { orpc } from '../../lib/rpc/orpc';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { removeSharedWorker } from '../../test-utils/remove-shared-worker';
import { render } from '../../test-utils/render';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ExploreCurrentPanel } from './explore-current-panel';

test('it shows a spinner and sends initialize before the worker reports its state', async () => {
  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  const rendered = await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker,
    },
    () => render(<ExploreCurrentPanel orpc={orpc} />),
  );

  expect(calls).toStrictEqual([{ type: ClientMessageType.Initialize }]);
  expect(rendered.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
});

test('it reports the simulation as unavailable when SharedWorker is unsupported', async () => {
  removeSharedWorker();

  const rendered = await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker: undefined,
    },
    () => render(<ExploreCurrentPanel orpc={orpc} />),
  );

  expect(rendered.getByRole('status')).toHaveTextContent(/activity simulation is unavailable/i);
});

test('it starts an activity for the selected node once initialized, sending the started row', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'node_1' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        render(<ExploreCurrentPanel orpc={orpc} />);

        await waitFor(() => {
          expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
        });
      },
    );
  });

  const sent = calls.find((call) => isSetActivityMessage(call));

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  invariant(sent !== undefined, 'expected a set-activity message');
  invariant(minted !== undefined, 'expected the start to mint an active row');
  expect(sent.activity.id).toBe(minted.id);
  expect(sent.activity.scopeID).toBe('node_1');
});

test('it requests a resync instead of starting when the same scope is already active', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const node = createMockWorldMapNode({ id: 'node_1' });

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

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        render(<ExploreCurrentPanel orpc={orpc} />);

        await waitFor(() => {
          expect(calls).toContainEqual({
            avatarID: avatar.id,
            type: ClientMessageType.RequestResync,
          });
        });

        expect(calls.some((call) => isSetActivityMessage(call))).toBeFalse();
      },
    );
  });
});

test('it renders the node and its codex fragment once the worker reports the sent activity', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'node_1' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        const inner = render(<ExploreCurrentPanel orpc={orpc} />);

        await waitFor(() => {
          expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
        });

        return inner;
      },
    );

    const sent = calls.find((call) => isSetActivityMessage(call));

    invariant(sent !== undefined, 'expected a set-activity message');

    await withIdleWorkerHandle(
      {
        activity: createMockActivitySnapshot({ id: sent.activity.id }),
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        rendered.refresh();

        const codex = await rendered.findByTestId('world-map-node-codex-stub');

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

  setSelectedNode(node);

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };
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
        const rendered = render(<ExploreCurrentPanel orpc={orpc} />);

        const retry = await rendered.findByTestId('start-activity-retry');

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

  await db.avatarCollection.create({ userID: signedIn.userID });

  setSelectedNode(createMockWorldMapNode({ id: 'node_1' }));

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };
  const user = userEvent.setup();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = await withIdleWorkerHandle(
      {
        activity: undefined,
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        const inner = render(<ExploreCurrentPanel orpc={orpc} />);

        await waitFor(() => {
          expect(calls.some((call) => isSetActivityMessage(call))).toBeTrue();
        });

        return inner;
      },
    );

    const sent = calls.find((call) => isSetActivityMessage(call));

    invariant(sent !== undefined, 'expected a set-activity message');

    await withIdleWorkerHandle(
      {
        activity: createMockActivitySnapshot({ id: sent.activity.id }),
        failureAction: ActivityFailureAction.Abort,
        initialized: true,
        worker,
      },
      async () => {
        rendered.refresh();

        const checkbox = await rendered.findByLabelText('Auto-retry on failure');

        expect(checkbox).not.toBeChecked();

        await user.click(checkbox);

        expect(calls).toContainEqual({
          failureAction: ActivityFailureAction.Retry,
          type: ClientMessageType.SetFailureAction,
        });
      },
    );
  });
});
