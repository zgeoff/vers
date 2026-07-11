/**
 * Whether this runtime exposes the `SharedWorker` constructor. False on the server and in browsers
 * that lack it (Android Chrome, older Safari), where the idle simulation cannot run.
 */
export function isSharedWorkerSupported(): boolean {
  return typeof SharedWorker !== 'undefined';
}
