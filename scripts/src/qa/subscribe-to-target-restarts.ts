import type { CDPClient } from './types';

// Chrome keeps a shared worker's target while a session stays attached, and starts the worker that
// next takes the target paused for the debugger, so it never runs its script until a session
// resumes it
export function subscribeToTargetRestarts(
  client: CDPClient,
  onResumeFailure: (message: string) => void,
): void {
  client.subscribe((event) => {
    if (event.method !== 'Inspector.targetReloadedAfterCrash') {
      return;
    }

    void (async () => {
      try {
        await client.send('Runtime.runIfWaitingForDebugger');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        onResumeFailure(message);
      }
    })();
  });
}
