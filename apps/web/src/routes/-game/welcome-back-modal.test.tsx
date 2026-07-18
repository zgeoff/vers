import { expect, onTestFinished, test } from 'bun:test';
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

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);
  expect(screen.getByText('Welcome back')).toBeInTheDocument();
  expect(screen.getByText('Catching up… 0 attempts, 0 level-ups so far.')).toBeInTheDocument();
});

test('it reports the running tally while fast-forwarding', () => {
  setResyncStatus({ attempts: 12, kind: 'fast-forwarding', levelUps: 1 });

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);
  expect(screen.getByText('Catching up… 12 attempts, 1 level-ups so far.')).toBeInTheDocument();
});

test('it reports the final tally when the catch-up is done', () => {
  setResyncStatus({ attempts: 42, kind: 'done', levelUps: 2 });

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);
  expect(screen.getByText('While you were away: 42 attempts, 2 level-ups.')).toBeInTheDocument();
});

test('it explains a capped catch-up', () => {
  setResyncStatus({ kind: 'capped' });

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);
  expect(screen.getByText(/reached its cap/)).toBeInTheDocument();
});

test('it offers a retry when the catch-up fails outright', () => {
  setResyncStatus({ avatarID: 'avatar_1', kind: 'failed' });

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);
  expect(screen.getByText('Catching up didn’t finish. Your progress is safe.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
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

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);

  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(calls).toStrictEqual([{ avatarID: 'avatar_1', type: ClientMessageType.RequestResync }]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it dismisses by clearing the resync status', async () => {
  const user = userEvent.setup();

  setResyncStatus({ attempts: 42, kind: 'done', levelUps: 2 });

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
