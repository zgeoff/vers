import { createSimulation } from '@vers/idle-core';
import xxhash from 'xxhash-wasm';
import type { InitializeMessage } from '../types';
import { connections } from './connections';
import { createInitialStateMessage } from './create-initial-state-message';
import { handleSimulationRestarted } from './handle-simulation-restarted';
import { handleSimulationStarted } from './handle-simulation-started';
import { handleSimulationStopped } from './handle-simulation-stopped';
import { handleSimulationUpdate } from './handle-simulation-update';
import { getSimulation, setSimulation } from './simulation';

export async function handleInitializeMessage(_message: InitializeMessage) {
  const hasher = await xxhash();

  // bail out if we already have a simulation initialized
  if (getSimulation()) {
    return;
  }

  const simulation = createSimulation(hasher);

  setSimulation(simulation);

  const initialStateMessage = createInitialStateMessage(
    simulation.getAppState(),
  );

  for (const connection of connections) {
    connection.postMessage(initialStateMessage);
  }

  simulation.addEventListener('updated', handleSimulationUpdate);
  simulation.addEventListener('stopped', handleSimulationStopped);
  simulation.addEventListener('started', handleSimulationStarted);
  simulation.addEventListener('restarted', handleSimulationRestarted);
}
