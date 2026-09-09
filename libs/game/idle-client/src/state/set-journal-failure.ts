import type { JournalFailure } from '../types';
import { useIdleStore } from './use-idle-store';

export function setJournalFailure(journalFailure: JournalFailure | null) {
  useIdleStore.setState(() => ({ journalFailure }));
}
