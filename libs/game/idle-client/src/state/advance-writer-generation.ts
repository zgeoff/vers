import { useIdleStore } from './use-idle-store';

/**
 * One writer promotion is one state event: the generation ticks and the initialize handshake
 * resets in a single write, so effects keyed on either field observe one consistent transition.
 */
export function advanceWriterGeneration() {
  useIdleStore.setState((state) => ({
    initialized: false,
    writerGeneration: state.writerGeneration + 1,
  }));
}
