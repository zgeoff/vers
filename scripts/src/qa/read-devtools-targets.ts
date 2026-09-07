import { z } from 'zod';
import type { DevToolsTarget } from './types';

const REQUEST_TIMEOUT_MS = 5000;

const targetSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  type: z.string(),
  url: z.string(),
  webSocketDebuggerUrl: z.string().optional(),
});

export async function readDevToolsTargets(endpoint: string): Promise<Array<DevToolsTarget>> {
  const response = await fetch(`http://${endpoint}/json`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GET http://${endpoint}/json answered ${response.status}`);
  }

  const raw = await response.json();

  const targets: Array<DevToolsTarget> = [];

  for (const parsed of z.array(targetSchema).parse(raw)) {
    const target = { id: parsed.id, title: parsed.title, type: parsed.type, url: parsed.url };

    if (parsed.webSocketDebuggerUrl === undefined) {
      targets.push(target);
    } else {
      targets.push({ ...target, webSocketDebuggerUrl: parsed.webSocketDebuggerUrl });
    }
  }

  return targets;
}
