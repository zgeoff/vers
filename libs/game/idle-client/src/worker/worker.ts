import { createWorkerRuntime } from './create-worker-runtime';

declare let self: SharedWorkerGlobalScope;
const runtime = createWorkerRuntime();

self.addEventListener('connect', runtime.handleConnect);
