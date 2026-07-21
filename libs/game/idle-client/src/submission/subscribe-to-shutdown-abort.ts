import { fromCallback } from 'xstate';

/**
 * Bridges an external `AbortSignal` into the machine while `retrying` is active — sending
 * `SIGNAL_ABORTED` once, then detaching. Never sent at all when no signal was configured.
 */
export const subscribeToShutdownAbort = fromCallback<
  { type: 'SIGNAL_ABORTED' },
  { readonly signal: AbortSignal | undefined }
>((args) => {
  const input = args.input;

  if (input.signal === undefined) {
    return () => {};
  }

  if (input.signal.aborted) {
    args.sendBack({ type: 'SIGNAL_ABORTED' });

    return () => {};
  }

  const onAbort = (): void => {
    args.sendBack({ type: 'SIGNAL_ABORTED' });
  };

  input.signal.addEventListener('abort', onAbort, { once: true });

  return () => {
    input.signal?.removeEventListener('abort', onAbort);
  };
});
