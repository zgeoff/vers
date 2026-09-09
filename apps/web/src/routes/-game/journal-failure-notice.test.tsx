import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setJournalFailure, updateSaveStatus } from '@vers/idle-client';
import { render } from '../../test-utils/render';
import { JournalFailureNotice } from './journal-failure-notice';

test('it renders nothing while the journal is healthy', () => {
  render(<JournalFailureNotice />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it tells the player the device is out of storage and how far the server got', () => {
  updateSaveStatus({ activityID: 'activity_1', receivedVersion: 7, savedVersion: 9 });
  setJournalFailure({ activityID: 'activity_1', kind: 'quota' });
  render(<JournalFailureNotice />);

  expect(screen.getByText('This device is out of storage')).toBeInTheDocument();
  expect(screen.getByText('The server has received this run up to save 7.')).toBeInTheDocument();
});

test('it never claims the server holds a run it has not received', () => {
  setJournalFailure({ activityID: 'activity_1', kind: 'write' });
  render(<JournalFailureNotice />);

  expect(screen.getByText('This device could not save')).toBeInTheDocument();
  expect(screen.getByText('The server has not received any of this run yet.')).toBeInTheDocument();
});

test('it names the loss when the saved history cannot be read', () => {
  setJournalFailure({ activityID: 'activity_1', kind: 'unreadable' });
  render(<JournalFailureNotice />);

  expect(screen.getByText('Saved history is missing')).toBeInTheDocument();
  expect(screen.getByText(/anything the server has not received is lost/)).toBeInTheDocument();
});

test('it dismisses by clearing the failure', async () => {
  const user = userEvent.setup();

  setJournalFailure({ activityID: 'activity_1', kind: 'quota' });
  render(<JournalFailureNotice />);

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
