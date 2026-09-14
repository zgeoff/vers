import { connect, createServer } from 'node:net';
import type { Socket } from 'node:net';
import invariant from 'tiny-invariant';

interface StallingProxy {
  readonly baseURI: string;
  readonly stop: () => Promise<void>;
  readonly stopForwarding: () => void;
}

interface ProxiedConnection {
  readonly client: Socket;
  forwarding: boolean;
  readonly upstream: Socket;
}

export async function startStallingProxy(upstreamBaseURI: string): Promise<StallingProxy> {
  const upstreamURL = new URL(upstreamBaseURI);
  const connections = new Set<ProxiedConnection>();

  const server = createServer((client) => {
    const upstream = connect({ host: upstreamURL.hostname, port: Number(upstreamURL.port) });
    const connection: ProxiedConnection = { client, forwarding: true, upstream };

    connections.add(connection);

    const removeConnection = (): void => {
      connections.delete(connection);
      client.destroy();
      upstream.destroy();
    };

    client.pipe(upstream);

    upstream.on('data', (chunk) => {
      if (connection.forwarding) {
        client.write(chunk);
      }
    });

    client.on('close', removeConnection);
    client.on('error', removeConnection);
    upstream.on('close', removeConnection);
    upstream.on('error', removeConnection);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  invariant(address !== null && typeof address === 'object', 'a listening server has a port');

  const proxiedURL = new URL(upstreamBaseURI);

  proxiedURL.hostname = '127.0.0.1';
  proxiedURL.port = String(address.port);

  return {
    baseURI: proxiedURL.href,
    stop: async () => {
      for (const connection of connections) {
        connection.client.destroy();
        connection.upstream.destroy();
      }

      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
    stopForwarding: () => {
      for (const connection of connections) {
        connection.forwarding = false;
      }
    },
  };
}
