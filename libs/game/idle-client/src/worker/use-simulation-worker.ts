import { useEffect } from 'react';
import { setActivity } from '../state/set-activity';
import { setAvatar } from '../state/set-avatar';
import { setCombat } from '../state/set-combat';
import { setFailureAction } from '../state/set-failure-action';
import { setSimulationInitialized } from '../state/set-simulation-initialized';
import { setSimulationWorker } from '../state/set-simulation-worker';
import { useSimulationStore } from '../state/use-simulation-store';
import type { InitialStateMessage, SimulationUpdateMessage, WorkerMessage } from '../types';
import { WorkerMessageType } from '../types';
import { createDisconnectMessage } from './create-disconnect-message';

let hasRegisteredDisconnectListener = false;

export function useSimulationWorker() {
  const existingWorker = useSimulationStore((state) => state.worker);

  useEffect(() => {
    // Browsers without SharedWorker (Android Chrome, older Safari) would throw on construction;
    // the worker stays undefined and every consumer degrades to its no-worker branch.
    if (typeof SharedWorker === 'undefined') {
      return;
    }

    const worker =
      existingWorker ??
      // oxlint-disable-next-line unicorn/relative-url-style -- Vite's worker-import-meta-url plugin resolves this specifier as a relative file reference only with the leading './'; a bare specifier resolves to the same URL at runtime but Vite's static analysis would treat it as a bare package import and skip bundling it
      new SharedWorker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    setSimulationWorker(worker);

    // oxlint-disable-next-line unicorn/prefer-add-event-listener -- assigning onmessage starts MessagePort delivery; addEventListener also needs an explicit port.start()
    worker.port.onmessage = handleWorkerMessage;

    // Registered once for the page's lifetime, never from this effect's own cleanup: the effect's
    // `[existingWorker]` dependency re-runs right after the first mount creates a worker (the store
    // update it triggers changes `existingWorker`'s identity), and a cleanup-based send would fire
    // on that transition and disconnect the connection it just made.
    if (!hasRegisteredDisconnectListener) {
      hasRegisteredDisconnectListener = true;

      window.addEventListener('pagehide', handlePageHide);
    }
  }, [existingWorker]);

  return existingWorker;
}

function handlePageHide() {
  const worker = useSimulationStore.getState().worker;

  worker?.port.postMessage(createDisconnectMessage());
}

function handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
  if (isInitialStateMessage(event.data)) {
    setSimulationInitialized(true);
  }

  if (isInitialStateMessage(event.data) || isUpdateMessage(event.data)) {
    setAvatar(event.data.state.avatar);
    setActivity(event.data.state.activity);
    setCombat(event.data.state.combat);
    setFailureAction(event.data.state.failureAction);
  }
}

function isInitialStateMessage(message: WorkerMessage): message is InitialStateMessage {
  return message.type === WorkerMessageType.InitialState;
}

function isUpdateMessage(message: WorkerMessage): message is SimulationUpdateMessage {
  return message.type === WorkerMessageType.SimulationUpdate;
}
