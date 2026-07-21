import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import type { ClientMessage } from '@vers/idle-client';
import { ClientMessageType } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { GameSimulationMount } from './game-simulation-mount';

test('it sends the initialize message once a worker connects that has not reported state yet', () => {
  const calls: Array<ClientMessage> = [];
  const transport = { post: (message: ClientMessage) => calls.push(message) };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    transport,
  });

  render(<GameSimulationMount />);
  expect(calls).toStrictEqual([{ type: ClientMessageType.Initialize }]);
});

test('it sends nothing once the worker has already reported its state and no avatar is known', () => {
  const calls: Array<ClientMessage> = [];
  const transport = { post: (message: ClientMessage) => calls.push(message) };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport,
  });

  render(<GameSimulationMount />);
  expect(calls).toStrictEqual([]);
});

test('it sends nothing before a worker has connected', () => {
  const calls: Array<ClientMessage> = [];

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    transport: undefined,
  });

  render(<GameSimulationMount />);
  expect(calls).toStrictEqual([]);
});

test('it renders without error when the worker reports a stopped checkpoint stream', () => {
  setIdleWorkerHandle({
    activity: undefined,
    checkpointStreamError: { activityID: 'activity_1', reason: 'broken-chain-link' },
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport: undefined,
  });

  const rendered = render(<GameSimulationMount />);

  expect(rendered.container).toBeEmptyDOMElement();
});

test('it sends initialize then reports online once the active avatar resolves', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const calls: Array<ClientMessage> = [];
  const transport = { post: (message: ClientMessage) => calls.push(message) };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<GameSimulationMount />);

    await waitFor(() => {
      expect(calls).toContainEqual({
        avatarID: avatar.id,
        claim: true,
        type: ClientMessageType.ReportOnline,
      });
    });
  });
});

test('it never reports online without a known avatar', async () => {
  const calls: Array<ClientMessage> = [];
  const transport = { post: (message: ClientMessage) => calls.push(message) };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport,
  });

  await withRequestContext({}, () => {
    const rendered = render(<GameSimulationMount />);

    rendered.refresh();

    expect(calls).not.toContainEqual(
      expect.objectContaining({ type: ClientMessageType.ReportOnline }),
    );
  });
});

test('it reports online only once across re-renders', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const calls: Array<ClientMessage> = [];
  const transport = { post: (message: ClientMessage) => calls.push(message) };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<GameSimulationMount />);

    await waitFor(() => {
      expect(calls).toContainEqual({
        avatarID: avatar.id,
        claim: true,
        type: ClientMessageType.ReportOnline,
      });
    });

    rendered.refresh();
    rendered.refresh();

    const onlineReports = calls.filter((call) => call.type === ClientMessageType.ReportOnline);

    expect(onlineReports).toHaveLength(1);
  });
});

test('it reports online again when the browser comes back online', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const calls: Array<ClientMessage> = [];
  const transport = { post: (message: ClientMessage) => calls.push(message) };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<GameSimulationMount />);

    await waitFor(() => {
      expect(calls).toContainEqual({
        avatarID: avatar.id,
        claim: true,
        type: ClientMessageType.ReportOnline,
      });
    });

    globalThis.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(calls.filter((call) => call.type === ClientMessageType.ReportOnline)).toHaveLength(2);
    });
  });
});

test('it renders without error when the worker reports a stalled checkpoint flush', () => {
  setIdleWorkerHandle({
    activity: undefined,
    checkpointFlushStall: { activityID: 'activity_1', reason: 'network down', traceID: 'trace_1' },
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport: undefined,
  });

  const rendered = render(<GameSimulationMount />);

  expect(rendered.container).toBeEmptyDOMElement();
});
