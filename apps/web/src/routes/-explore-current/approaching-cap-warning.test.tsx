import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { setOfflineCapStatus } from '@vers/idle-client';
import { ApproachingCapWarning } from './approaching-cap-warning';

test('it renders nothing while no cap status is reported', () => {
  render(<ApproachingCapWarning />);
  expect(screen.queryByText(/reconnect/i)).not.toBeInTheDocument();
});

test('it warns with the remaining time while the budget drains', () => {
  setOfflineCapStatus({ halted: false, remainingMs: 5_400_000 });
  render(<ApproachingCapWarning />);
  expect(screen.getByText('Reconnect within 1h 30m to keep progressing.')).toBeInTheDocument();
});

test('it reports the pause once the worker halts at the boundary', () => {
  setOfflineCapStatus({ halted: true, remainingMs: 0 });
  render(<ApproachingCapWarning />);
  expect(screen.getByText('Progress is paused — reconnect to continue.')).toBeInTheDocument();
});
