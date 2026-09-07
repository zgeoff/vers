import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 5000;
const versionSchema = z.object({ webSocketDebuggerUrl: z.string() });

export async function readBrowserSocketURL(endpoint: string): Promise<string> {
  const response = await fetch(`http://${endpoint}/json/version`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GET http://${endpoint}/json/version answered ${response.status}`);
  }

  const raw = await response.json();

  const url = new URL(versionSchema.parse(raw).webSocketDebuggerUrl);

  url.host = endpoint;

  return url.toString();
}
