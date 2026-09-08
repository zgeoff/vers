import type { DevToolsTarget } from './types';

export function buildTargetSocketURL(target: DevToolsTarget, endpoint: string): string {
  const url = new URL(target.webSocketDebuggerUrl ?? `ws://${endpoint}/devtools/page/${target.id}`);

  url.host = endpoint;

  return url.toString();
}
