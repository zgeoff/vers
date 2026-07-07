import { useEffect } from 'react';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Mounts the idle simulation's SharedWorker for every game route: sends the one-time Initialize
 * message as soon as a worker connects that hasn't reported its state yet. Renders nothing — this
 * is the game layout's side-effect-only sibling to its `<Outlet />`.
 */
export function GameSimulationMount() {
  const idleWorkerHandle = useIdleWorkerHandle();

  useEffect(() => {
    if (idleWorkerHandle.worker !== undefined && !idleWorkerHandle.initialized) {
      sendIdleInitialize(idleWorkerHandle.worker);
    }
  }, [idleWorkerHandle.worker, idleWorkerHandle.initialized]);

  return null;
}
