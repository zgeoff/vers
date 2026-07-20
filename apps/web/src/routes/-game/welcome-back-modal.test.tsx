import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientMessage } from '@vers/idle-client';
import { ClientMessageType, setResyncStatus } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { WelcomeBackModal } from './welcome-back-modal';

test('it renders nothing while no resync is underway', () => {
  render(<WelcomeBackModal />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it masks the catch-up from its zero-tally start', () => {
  setResyncStatus({ attempts: 0, kind: 'fast-forwarding', levelUps: 0 });
  render(<WelcomeBackModal />);
  expect(screen.getByText('Welcome back')).toBeInTheDocument();
  expect(screen.getByText('Catching up… 0 attempts, 0 level-ups so far.')).toBeInTheDocument();
});

test('it reports the running tally while fast-forwarding', () => {
  setResyncStatus({ attempts: 12, kind: 'fast-forwarding', levelUps: 1 });
  render(<WelcomeBackModal />);
  expect(screen.getByText('Catching up… 12 attempts, 1 level-ups so far.')).toBeInTheDocument();
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

test('it retries by requesting a fresh resync and clearing the failed status', async () => {
  const user = userEvent.setup();
  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  setResyncStatus({ avatarID: 'avatar_1', kind: 'failed' });
  render(<WelcomeBackModal />);

  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(calls).toStrictEqual([
    { avatarID: 'avatar_1', claim: true, type: ClientMessageType.RequestResync },
  ]);

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
