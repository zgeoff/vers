import { useIdleStore } from './use-idle-store';

export function useJournalFailure() {
  return useIdleStore((state) => state.journalFailure);
}
