import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setJournalFailure, setSimulationSnapshot } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { render } from '../../test-utils/render';
import { JournalFailureNotice } from './journal-failure-notice';

test('it renders nothing while the journal is healthy', () => {
  render(<JournalFailureNotice />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it tells the player the device is out of storage and how far the server got', () => {
  setJournalFailure({ activityID: 'activity_1', kind: 'quota', receivedVersion: 7 });
  render(<JournalFailureNotice />);

  expect(screen.getByText('This device is out of storage')).toBeInTheDocument();
  expect(screen.getByText('The server has received this run up to save 7.')).toBeInTheDocument();
});

test('it never claims the server holds a run it has not received', () => {
  setJournalFailure({ activityID: 'activity_1', kind: 'write', receivedVersion: 0 });
  render(<JournalFailureNotice />);

  expect(screen.getByText('This device could not save')).toBeInTheDocument();
  expect(screen.getByText('The server has not received any of this run yet.')).toBeInTheDocument();
});

test('it calls unreceived progress unconfirmed when the saved history cannot be read', () => {
  setJournalFailure({ activityID: 'activity_1', kind: 'unreadable', receivedVersion: 4 });
  render(<JournalFailureNotice />);

  expect(screen.getByText('Saved history cannot be read')).toBeInTheDocument();
  expect(screen.getByText(/the server has not received is unconfirmed/)).toBeInTheDocument();
});

test('it keeps showing the failure of the run it stopped while no other run is live', () => {
  const activity = createMockActivitySnapshot();

  setSimulationSnapshot({ activity, failureAction: ActivityFailureAction.Abort });
  setJournalFailure({ activityID: activity.id, kind: 'write', receivedVersion: 2 });
  render(<JournalFailureNotice />);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('it hides a failure that belongs to a previous run once another run is live', () => {
  setJournalFailure({ activityID: 'ended-activity', kind: 'write', receivedVersion: 2 });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot(),
    failureAction: ActivityFailureAction.Abort,
  });

  render(<JournalFailureNotice />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it dismisses by clearing the failure', async () => {
  const user = userEvent.setup();

  setJournalFailure({ activityID: 'activity_1', kind: 'quota', receivedVersion: null });
  render(<JournalFailureNotice />);

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
