import invariant from 'tiny-invariant';
import type { ClientMessage } from '../types';
import { connections } from './connections';
import { handleClientMessage } from './handle-client-message';
import { runSimulation } from './run-simulation';
import { getSimulation } from './simulation';

declare let self: SharedWorkerGlobalScope;

self.addEventListener('connect', handleConnect);

// 20 updates per second = 50ms batches
const targetUpdatesPerSecond = 20;
const timestep = 1000 / targetUpdatesPerSecond;

let running = false;

console.log('-- worker initialized');

// standard shared worker setup - cache our listeners so we can message them later
function handleConnect(event: MessageEvent) {
  console.log('-- received connect event');

  const [port] = event.ports;

  invariant(port, 'port is required');

  connections.add(port);
  port.start();

  port.addEventListener('message', (messageEvent: MessageEvent<ClientMessage>) => {
    void handleClientMessage(messageEvent);
  });

  // ensure we're only running one loop per worker
  if (!running) {
    running = true;

    void tick();
  }
}

let lastFrameTime = performance.now();
let accumulator = 0;

// our main loop function uses a fixed timestep to ensure consistent updates as
// we're not directly tied to UI updates nor do we have access to requestAnimationFrame
async function tick() {
  const now = performance.now();
  const frameTime = now - lastFrameTime;

  accumulator += frameTime;

  while (accumulator >= timestep) {
    accumulator -= timestep;

    const simulation = getSimulation();

    if (simulation) {
      await runSimulation(simulation, timestep);
    }
  }

  lastFrameTime = now;

  await delay(1);

  void tick();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
