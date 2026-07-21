import { useIdleStore } from './use-idle-store';

/**
 * One writer promotion is one state event: the generation ticks, the initialize handshake resets,
 * and every RPC call still awaiting the dead writer aborts — a single write, so effects keyed on
 * any of the three observe one consistent transition.
 */
export function advanceWriterGeneration() {
  useIdleStore.setState((state) => {
    state.writerAbortController.abort();

    return {
      initialized: false,
      writerAbortController: new AbortController(),
      writerGeneration: state.writerGeneration + 1,
    };
  });
}
