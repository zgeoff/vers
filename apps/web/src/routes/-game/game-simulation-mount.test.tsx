import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { GameSimulationMount } from './game-simulation-mount';

test('it calls initialize once a worker connects that has not reported state yet', () => {
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    writerAbortSignal: new AbortController().signal,
  });

  render(<GameSimulationMount />);

  expect(client.initialize).toHaveBeenCalledExactlyOnceWith({}, expect.anything());
});

test('it calls nothing once the worker has already reported its state and no avatar is known', () => {
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  render(<GameSimulationMount />);

  expect(client.initialize).not.toHaveBeenCalled();
  expect(client.reportOnline).not.toHaveBeenCalled();
});

test('it calls nothing before a worker has connected', () => {
  setIdleWorkerHandle({
    activity: undefined,
    client: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    writerAbortSignal: new AbortController().signal,
  });

  render(<GameSimulationMount />);
});

test('it calls initialize then reports online once the active avatar resolves', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<GameSimulationMount />);

    await waitFor(() => {
      expect(client.reportOnline).toHaveBeenCalledExactlyOnceWith(
        { avatarID: avatar.id, claim: true },
        expect.anything(),
      );
    });
  });
});

test('it never reports online without a known avatar', async () => {
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({}, () => {
    const rendered = render(<GameSimulationMount />);

    rendered.refresh();

    expect(client.reportOnline).not.toHaveBeenCalled();
  });
});

test('it reports online only once across re-renders', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<GameSimulationMount />);

    await waitFor(() => {
      expect(client.reportOnline).toHaveBeenCalledExactlyOnceWith(
        { avatarID: avatar.id, claim: true },
        expect.anything(),
      );
    });

    rendered.refresh();
    rendered.refresh();

    expect(client.reportOnline).toHaveBeenCalledTimes(1);
  });
});

test('it reports online again when the browser comes back online', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<GameSimulationMount />);

    await waitFor(() => {
      expect(client.reportOnline).toHaveBeenCalledExactlyOnceWith(
        { avatarID: avatar.id, claim: true },
        expect.anything(),
      );
    });

    globalThis.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(client.reportOnline).toHaveBeenCalledTimes(2);
    });
  });
});
