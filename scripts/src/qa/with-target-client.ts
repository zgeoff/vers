import { buildTargetSocketURL } from './build-target-socket-url';
import { createCDPClient } from './create-cdp-client';
import { readDevToolsTargets } from './read-devtools-targets';
import type { CDPClient } from './types';

export async function withTargetClient<T>(
  endpoint: string,
  targetID: string,
  run: (client: CDPClient) => Promise<T>,
): Promise<T> {
  const targets = await readDevToolsTargets(endpoint);

  const target = targets.find((candidate) => candidate.id === targetID);

  if (target === undefined) {
    throw new Error(`no target ${targetID} at ${endpoint}`);
  }

  const client = await createCDPClient(buildTargetSocketURL(target, endpoint));

  try {
    return await run(client);
  } finally {
    client.close();
  }
}
