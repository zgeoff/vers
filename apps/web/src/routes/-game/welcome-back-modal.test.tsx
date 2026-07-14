import { expect, onTestFinished, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setResyncStatus } from '@vers/idle-client';
import { WelcomeBackModal } from './welcome-back-modal';

test('it renders nothing while no resync is underway', () => {
  render(<WelcomeBackModal />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it masks the check before any attempts land', () => {
  setResyncStatus({ kind: 'checking' });

  onTestFinished(() => {
    setResyncStatus(null);
  });

  render(<WelcomeBackModal />);
  expect(screen.getByText('Welcome back')).toBeInTheDocument();
  expect(screen.getByText('Checking your progress…')).toBeInTheDocument();
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
