export type SimulationTransportKind = 'none' | 'shared-worker' | 'web-locks';

interface TransportCapabilities {
  readonly hasSharedWorker: boolean;
  readonly hasWebLocks: boolean;
}

/**
 * A real shared process beats an elected one, so SharedWorker wins where present; Web Locks
 * election covers the rest. With neither, the simulation cannot run and consumers keep their
 * no-transport degradation.
 */
export function pickTransportKind(capabilities: TransportCapabilities): SimulationTransportKind {
  if (capabilities.hasSharedWorker) {
    return 'shared-worker';
  }

  if (capabilities.hasWebLocks) {
    return 'web-locks';
  }

  return 'none';
}
