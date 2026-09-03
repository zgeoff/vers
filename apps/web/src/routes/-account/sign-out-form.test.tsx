import { expect, mock, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFailureAction } from '@vers/idle-core';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { SignOutForm } from './sign-out-form';

test('it signs out directly when this device holds nothing undelivered', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
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
    expect(client.removeUndeliveredWork).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

test('it warns before sign-out when this device holds undelivered work, and does not sign out', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

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

  await withRequestContext({}, async () => {
    renderWithRouter(<SignOutForm action={action} />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });

    await user.click(logoutButton);

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toHaveTextContent('2 runs, about 2 minutes of play');
    expect(action).not.toHaveBeenCalled();
  });
});

test('it discards the undelivered work before signing out when the player confirms', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

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

  await withRequestContext({}, async () => {
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
  });
});

test('it reports the failure and stays open when discarding the work fails', async () => {
  const user = userEvent.setup();
  const action = mock(() => Promise.resolve(undefined));

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

  await withRequestContext({}, async () => {
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

  await withRequestContext({}, async () => {
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
