import { useEffect } from 'react';
import { setActivity } from '../state/set-activity';
import { setAvatar } from '../state/set-avatar';
import { setCombat } from '../state/set-combat';
import { setSimulationInitialized } from '../state/set-simulation-initialized';
import { setSimulationWorker } from '../state/set-simulation-worker';
import { useSimulationStore } from '../state/use-simulation-store';
import type { InitialStateMessage, SimulationUpdateMessage, WorkerMessage } from '../types';
import { WorkerMessageType } from '../types';
import SimulationWorker from './worker.ts?sharedworker';

export function useSimulationWorker() {
  const existingWorker = useSimulationStore((state) => state.worker);

  useEffect(() => {
    // Browsers without SharedWorker (Android Chrome, older Safari) would throw on construction;
    // the worker stays undefined and every consumer degrades to its no-worker branch.
    if (typeof SharedWorker === 'undefined') {
      return;
    }

    const worker = existingWorker ?? new SimulationWorker();

    setSimulationWorker(worker);

    // oxlint-disable-next-line unicorn/prefer-add-event-listener -- assigning onmessage starts MessagePort delivery; addEventListener also needs an explicit port.start()
    worker.port.onmessage = handleWorkerMessage;
  }, [existingWorker]);

  return existingWorker;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
  if (isInitialStateMessage(event.data)) {
    setSimulationInitialized(true);
  }

  if (isInitialStateMessage(event.data) || isUpdateMessage(event.data)) {
    setAvatar(event.data.state.avatar);
    setActivity(event.data.state.activity);
    setCombat(event.data.state.combat);
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function isInitialStateMessage(message: WorkerMessage): message is InitialStateMessage {
  return message.type === WorkerMessageType.InitialState;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function isUpdateMessage(message: WorkerMessage): message is SimulationUpdateMessage {
  return message.type === WorkerMessageType.SimulationUpdate;
}
