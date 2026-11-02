import type { ChromeNamespace, ChromeRefusal, ChromeState } from './types';

type NetworkTarget =
  | { readonly kind: 'ready'; readonly namespace: ChromeNamespace; readonly state: ChromeState }
  | ChromeRefusal;

export function pickNetworkTarget(running: ChromeState | undefined): NetworkTarget {
  if (running === undefined) {
    return { kind: 'no-browser' };
  }

  if (running.namespace === null) {
    return { kind: 'no-namespace' };
  }

  return { kind: 'ready', namespace: running.namespace, state: running };
}
