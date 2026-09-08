export type SimulationTransportKind = 'none' | 'shared-worker' | 'web-locks';

interface TransportCapabilities {
  readonly hasSharedWorker: boolean;
  readonly hasWebLocks: boolean;
}

// both transports elect through the writer lock, so a browser without Web Locks gets neither
export function pickTransportKind(capabilities: TransportCapabilities): SimulationTransportKind {
  if (!capabilities.hasWebLocks) {
    return 'none';
  }

  return capabilities.hasSharedWorker ? 'shared-worker' : 'web-locks';
}
