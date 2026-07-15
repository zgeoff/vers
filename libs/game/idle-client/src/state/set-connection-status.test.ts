import { expect, onTestFinished, test } from 'bun:test';
import { setConnectionStatus } from './set-connection-status';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored connection status wholesale', () => {
  const initialConnectionOnline = useIdleStore.getState().connectionOnline;

  onTestFinished(() => {
    useIdleStore.setState({ connectionOnline: initialConnectionOnline });
  });

  setConnectionStatus(false);
  expect(useIdleStore.getState().connectionOnline).toBeFalse();
  setConnectionStatus(true);
  expect(useIdleStore.getState().connectionOnline).toBeTrue();
});
