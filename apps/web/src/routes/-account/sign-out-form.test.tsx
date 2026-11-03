import { expect, mock, onTestFinished, test } from 'bun:test';
import { onlineManager } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFailureAction } from '@vers/idle-core';
import { mockAvatarService } from '@vers/mock-services/avatar';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import { NetworkFailureError } from '../../lib/offline/network-failure-error';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { orpc } from '../../lib/rpc/orpc';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { SignOutForm } from './sign-out-form';

test('it signs out directly when this device holds nothing undelivered', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));
  const client = createStubWorkerClient();

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log out' })).not.toBeDisabled();
    });

    expect(action).toHaveBeenCalledOnce();
    expect(client.readUndeliveredWork).toHaveBeenCalledOnce();
    expect(client.removeUndeliveredWork).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

test("it asks the worker about the signed-in user's avatars only", async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));
  const client = createStubWorkerClient();

  const signedIn = await createSignedInUser();
  const other = await createSignedInUser();
  const first = await db.avatarCollection.create({ userID: signedIn.userID });
  const second = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.avatarCollection.create({ userID: other.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    await waitFor(() => {
      expect(action).toHaveBeenCalledOnce();
    });

    expect(client.readUndeliveredWork).toHaveBeenCalledExactlyOnceWith(
      { avatarIDs: expect.toIncludeSameMembers([first.id, second.id]) },
      expect.anything(),
    );
  });
});

test('it warns before sign-out when this device holds undelivered work, and does not sign out', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient({
    readUndeliveredWork: () => Promise.resolve({ activityCount: 2, playMs: 90_000 }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toHaveTextContent('2 runs, about 2 minutes of play');
    expect(action).not.toHaveBeenCalled();
  });
});

test("it discards the signed-in user's undelivered work before signing out when the player confirms", async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient({
    readUndeliveredWork: () => Promise.resolve({ activityCount: 1, playMs: 5000 }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const confirmButton = await screen.findByRole('button', { name: 'Log out anyway' });

    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log out anyway' })).not.toBeDisabled();
    });

    expect(action).toHaveBeenCalledOnce();
    expect(client.removeUndeliveredWork).toHaveBeenCalledBefore(action);

    expect(client.removeUndeliveredWork).toHaveBeenCalledExactlyOnceWith(
      { avatarIDs: [avatar.id] },
      expect.anything(),
    );
  });
});

test('it reports the failure and stays open when discarding the work fails', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient({
    readUndeliveredWork: () => Promise.resolve({ activityCount: 1, playMs: 5000 }),
    removeUndeliveredWork: () => Promise.reject(new Error('unreachable')),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const confirmButton = await screen.findByRole('button', { name: 'Log out anyway' });

    await user.click(confirmButton);
    await screen.findByRole('alert');

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(confirmButton).not.toBeDisabled();
  });
});

test('it neither discards nor signs out when the player cancels, and closes the dialog', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient({
    readUndeliveredWork: () => Promise.resolve({ activityCount: 1, playMs: 5000 }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });

    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(client.removeUndeliveredWork).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });
});

test('it signs out directly when no worker client is mounted', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

  setIdleWorkerHandle({
    activity: undefined,
    client: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({}, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log out' })).not.toBeDisabled();
    });

    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

test('it shows that log out needs the network, and does not sign out, when the avatar roster cannot be read', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

  const client = createStubWorkerClient({
    readUndeliveredWork: () => Promise.resolve({ activityCount: 1, playMs: 5000 }),
  });

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  server.use(mockAvatarService.getAvatars.handler(() => HttpResponse.error()));

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(
      'Log out needs a network connection. Check your connection and try again.',
    );

    expect(action).not.toHaveBeenCalled();
    expect(client.removeUndeliveredWork).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

test('it shows that log out needs the network, and does not sign out, when the browser is offline', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));
  const client = createStubWorkerClient();

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  server.use(mockAvatarService.getAvatars.handler(() => HttpResponse.error()));
  onlineManager.setOnline(false);

  onTestFinished(() => {
    onlineManager.setOnline(true);
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(
      'Log out needs a network connection. Check your connection and try again.',
    );

    expect(action).not.toHaveBeenCalled();
  });
});

test('it shows that log out needs the network, and does not sign out, when the worker cannot read its outbox', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

  const client = createStubWorkerClient({
    readUndeliveredWork: () => Promise.reject(new Error('worker gone')),
  });

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(
      'Log out needs a network connection. Check your connection and try again.',
    );

    expect(action).not.toHaveBeenCalled();
  });
});

test('it shows that log out needs the network, and keeps the session, when the sign-out call fails', async () => {
  const user = userEvent.setup();

  const action = mock(() =>
    Promise.reject(new NetworkFailureError({ cause: new TypeError('Failed to fetch') })),
  );

  const client = createStubWorkerClient();
  const queryClient = buildQueryClient();

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />, { queryClient });

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(
      'Log out needs a network connection. Check your connection and try again.',
    );

    expect(action).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    expect(logoutButton).not.toBeDisabled();
  });
});

test('it shows that log out needs the network in the warning when the sign-out call fails after the discard', async () => {
  const user = userEvent.setup();

  const action = mock(() =>
    Promise.reject(new NetworkFailureError({ cause: new TypeError('Failed to fetch') })),
  );

  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ userID: signedIn.userID });

  const client = createStubWorkerClient({
    readUndeliveredWork: () => Promise.resolve({ activityCount: 1, playMs: 5000 }),
  });

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const confirmButton = await screen.findByRole('button', { name: 'Log out anyway' });

    await user.click(confirmButton);

    const dialog = screen.getByRole('dialog');

    const alert = await within(dialog).findByRole('alert');

    expect(alert).toHaveTextContent(
      'Log out needs a network connection. Check your connection and try again.',
    );

    expect(confirmButton).not.toBeDisabled();
  });
});

test('it forgets the cached queries once sign-out completes', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));
  const client = createStubWorkerClient();
  const queryClient = buildQueryClient();

  queryClient.setQueryData(orpc.avatar.getAvatars.queryKey({ input: {} }), {
    activeAvatarID: null,
    avatars: [],
  });

  const signedIn = await createSignedInUser();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<SignOutForm action={action} />, { queryClient });

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log out' })).not.toBeDisabled();
    });

    expect(action).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
