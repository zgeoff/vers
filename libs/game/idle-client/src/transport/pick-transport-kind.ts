export type SimulationTransportKind = 'none' | 'shared-worker' | 'web-locks';

interface TransportCapabilities {
  readonly hasSharedWorker: boolean;
  readonly hasWebLocks: boolean;
}

export function pickTransportKind(capabilities: TransportCapabilities): SimulationTransportKind {
  if (capabilities.hasSharedWorker) {
    return 'shared-worker';
  }

  if (capabilities.hasWebLocks) {
    return 'web-locks';
  }

  return 'none';
}
