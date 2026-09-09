import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setStoragePersistence, updateSaveStatus } from '@vers/idle-client';
import { render } from '../../test-utils/render';
import { SaveStatusLine } from './save-status-line';

test('it renders nothing before the worker reports a save', () => {
  render(<SaveStatusLine />);

  expect(screen.queryByText(/This device/)).not.toBeInTheDocument();
});

test('it shows the saved cursor apart from what the server received', () => {
  updateSaveStatus({ activityID: 'activity_1', receivedVersion: 3, savedVersion: 5 });
  setStoragePersistence('granted');
  render(<SaveStatusLine />);

  expect(
    screen.getByText('This device: saved 5 · server has 3 · Offline saves: kept'),
  ).toBeInTheDocument();
});

test('it says the server has none of a run it has not received', () => {
  updateSaveStatus({ activityID: 'activity_1', receivedVersion: null, savedVersion: 1 });
  setStoragePersistence('denied');
  render(<SaveStatusLine />);

  expect(
    screen.getByText('This device: saved 1 · server has none · Offline saves: best effort'),
  ).toBeInTheDocument();
});
