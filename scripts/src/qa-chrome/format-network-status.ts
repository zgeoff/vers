import { formatRouteCount } from './format-route-count';
import type { ChromeNamespace, ChromeState, SavedRoute } from './types';

interface NetworkStatus {
  readonly isLinkUp: boolean | null;
  readonly namespace: ChromeNamespace;
  readonly routes: ReadonlyArray<SavedRoute>;
  readonly state: ChromeState;
}

export function formatNetworkStatus(status: NetworkStatus): string {
  const browser = `browser: pid ${status.state.leaderPID}, DevTools on 127.0.0.1:${status.state.port}, namespace holder pid ${status.namespace.holderPID}`;

  return [browser, formatNetworkLine(status)].join('\n');
}

function formatNetworkLine(status: NetworkStatus): string {
  const cut = status.namespace.cut;

  if (cut !== null) {
    const link = status.isLinkUp === true ? 'up, so a restore is due' : 'down';

    return `network: cut — ${cut.interfaceName} is ${link}, with ${formatRouteCount(cut.routes.length)} saved for restore`;
  }

  const defaults = status.routes.filter((route) => route.dst === 'default');

  if (defaults.length === 0) {
    return 'network: no default route in the namespace';
  }

  const via = defaults.map((route) => `${route.gateway ?? 'direct'} on ${route.dev}`).join(', ');

  return `network: up — default route via ${via}`;
}
