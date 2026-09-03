import type { WorkerCallContext } from './types';

export function handleDisconnectMessage(callContext: WorkerCallContext): void {
  // deferred to a macrotask — closing synchronously here would race this very call's own answer,
  // which still has to go out over the same connection
  setTimeout(() => {
    callContext.close();
  }, 0);
}
