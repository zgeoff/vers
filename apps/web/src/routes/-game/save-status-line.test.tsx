import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setSimulationSnapshot, setStoragePersistence, updateSaveStatus } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { render } from '../../test-utils/render';
import { SaveStatusLine } from './save-status-line';

test('it renders nothing before the worker reports a save', () => {
  render(<SaveStatusLine />);

  expect(screen.queryByText(/This device/)).not.toBeInTheDocument();
});

test('it shows the saved cursor apart from what the server received', () => {
  const activity = createMockActivitySnapshot();

  setSimulationSnapshot({ activity, failureAction: ActivityFailureAction.Abort });
  updateSaveStatus({ activityID: activity.id, receivedVersion: 3, savedVersion: 5 });
  setStoragePersistence('granted');
  render(<SaveStatusLine />);

  expect(
    screen.getByText('This device: saved 5 · server has 3 · Offline saves: kept'),
  ).toBeInTheDocument();
});

test('it says the server has none of a run it has not received', () => {
  const activity = createMockActivitySnapshot();

  setSimulationSnapshot({ activity, failureAction: ActivityFailureAction.Abort });
  updateSaveStatus({ activityID: activity.id, receivedVersion: null, savedVersion: 1 });
  setStoragePersistence('denied');
  render(<SaveStatusLine />);

  expect(
    screen.getByText('This device: saved 1 · server has none · Offline saves: best effort'),
  ).toBeInTheDocument();
});

test('it hides a report that belongs to the previous run once a new run is live', () => {
  updateSaveStatus({ activityID: 'ended-activity', receivedVersion: 3, savedVersion: 5 });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot(),
    failureAction: ActivityFailureAction.Abort,
  });

  render(<SaveStatusLine />);

  expect(screen.queryByText(/This device/)).not.toBeInTheDocument();
});
