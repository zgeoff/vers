import { connect } from 'node:net';

const TEST_CONTAINER_PORT = 32_999;

/**
 * Whether the shared postgres test container (started by
 * `pg:test-container:start`, or a previous run's leftover `withReuse`
 * container) is already listening on its fixed host port.
 */
export function isTestContainerReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: 'localhost', port: TEST_CONTAINER_PORT, timeout: 1000 });

    socket.once('connect', () => {
      socket.destroy();

      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();

      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();

      resolve(false);
    });
  });
}
