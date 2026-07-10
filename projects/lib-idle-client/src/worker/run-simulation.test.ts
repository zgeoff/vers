import { test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import xxhash from 'xxhash-wasm';
import { runSimulation } from './run-simulation';

const hasher = await xxhash();

test.todo('it restarts the activity if it fails', async () => {
  const simulation = createSimulation(hasher);

  await runSimulation(simulation, 1000);
});

test.todo('it does not restart the activity if it fails and failure action is not retry', async () => {
  const simulation = createSimulation(hasher);

  await runSimulation(simulation, 50);
});

test.todo('it restarts the activity if it completes', async () => {
  const simulation = createSimulation(hasher);

  await runSimulation(simulation, 50);
});
