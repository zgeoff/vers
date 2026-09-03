import { connect } from 'node:net';

const TEST_CONTAINER_PORT = 32_999;

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
