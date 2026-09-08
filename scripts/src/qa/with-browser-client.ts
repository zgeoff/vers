import { createCDPClient } from './create-cdp-client';
import { readBrowserSocketURL } from './read-browser-socket-url';
import type { CDPClient } from './types';

export async function withBrowserClient<T>(
  endpoint: string,
  run: (client: CDPClient) => Promise<T>,
): Promise<T> {
  const socketURL = await readBrowserSocketURL(endpoint);
  const client = await createCDPClient(socketURL);

  try {
    return await run(client);
  } finally {
    client.close();
  }
}
