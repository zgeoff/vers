import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setResyncStatus } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { WelcomeBackModal } from './welcome-back-modal';

test('it renders nothing while no resync is underway', () => {
  render(<WelcomeBackModal />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it masks the catch-up from its zero-tally start with a non-dismissible lockout', () => {
  setResyncStatus({ attempts: 0, kind: 'fast-forwarding', levelUps: 0 });
  render(<WelcomeBackModal />);

  expect(screen.getByText('Welcome back')).toBeInTheDocument();
  expect(screen.getByText('Catching up… 0 attempts, 0 level-ups so far.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
});

test('it reports the running tally while fast-forwarding, still with no close button', () => {
  setResyncStatus({ attempts: 12, kind: 'fast-forwarding', levelUps: 1 });
  render(<WelcomeBackModal />);

  expect(screen.getByText('Catching up… 12 attempts, 1 level-up so far.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
});

test('it reports the final tally when the catch-up is done', () => {
  setResyncStatus({ attempts: 42, kind: 'done', levelUps: 2 });
  render(<WelcomeBackModal />);

  expect(screen.getByText('While you were away: 42 attempts, 2 level-ups.')).toBeInTheDocument();
});

test('it explains a capped catch-up', () => {
  setResyncStatus({ kind: 'capped' });
  render(<WelcomeBackModal />);

  expect(screen.getByText(/reached its cap/)).toBeInTheDocument();
});

test('it offers a retry when the catch-up fails outright', () => {
  setResyncStatus({ avatarID: 'avatar_1', kind: 'failed' });
  render(<WelcomeBackModal />);

  expect(screen.getByText('Catching up didn’t finish. Your progress is safe.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('it offers a sign-in link back to this page when the session expired mid catch-up', () => {
  setResyncStatus({ avatarID: 'avatar_1', kind: 'session-expired' });
  render(<WelcomeBackModal />);

  expect(
    screen.getByText('Your session expired while catching up. Your progress is safe.'),
  ).toBeInTheDocument();

  const redirectTo = `${globalThis.location.pathname}${globalThis.location.search}`;

  const searchParams = new URLSearchParams({ redirect: redirectTo });

  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    `/login?${searchParams.toString()}`,
  );
});

test('it retries by reporting online and clearing the failed status', async () => {
  const user = userEvent.setup();
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  setResyncStatus({ avatarID: 'avatar_1', kind: 'failed' });
  render(<WelcomeBackModal />);

  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(client.reportOnline).toHaveBeenCalledExactlyOnceWith(
    { avatarID: 'avatar_1', claim: true },
    expect.anything(),
  );

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it dismisses by clearing the resync status', async () => {
  const user = userEvent.setup();

  setResyncStatus({ attempts: 42, kind: 'done', levelUps: 2 });
  render(<WelcomeBackModal />);

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it renders nothing when the catch-up ended on another device taking the run', () => {
  setResyncStatus({ activityID: 'activity_1', kind: 'active-elsewhere' });
  render(<WelcomeBackModal />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it offers a reload action when the account switched avatars mid catch-up', () => {
  setResyncStatus({
    activeAvatarName: 'Someone Else',
    attempts: 0,
    kind: 'avatar-switched',
    levelUps: 0,
  });

  render(<WelcomeBackModal />);

  expect(screen.getByRole('alert')).toHaveTextContent(
    'You’re now playing as Someone Else. Reload to continue.',
  );

  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});

test('it offers a reload action when the running build no longer supports the current content', () => {
  setResyncStatus({ kind: 'sim-version-expired' });
  render(<WelcomeBackModal />);

  expect(screen.getByText('The game has been updated — reload to continue.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});

test('it reports the tallies a fast-forward earned before the account switched avatars', () => {
  setResyncStatus({
    activeAvatarName: 'Someone Else',
    attempts: 7,
    kind: 'avatar-switched',
    levelUps: 1,
  });

  render(<WelcomeBackModal />);

  expect(screen.getByRole('alert')).toHaveTextContent(
    'You’re now playing as Someone Else. Reload to continue.',
  );

  expect(screen.getByText('While you were away: 7 attempts, 1 level-ups.')).toBeInTheDocument();
});
