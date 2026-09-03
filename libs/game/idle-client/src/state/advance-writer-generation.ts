import { useIdleStore } from './use-idle-store';

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
