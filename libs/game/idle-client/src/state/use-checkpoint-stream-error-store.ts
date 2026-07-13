import { create } from 'zustand';
import type { CheckpointStreamError } from '../types';

interface CheckpointStreamErrorStore {
  checkpointStreamError: CheckpointStreamError | null;
}

export const useCheckpointStreamErrorStore = create<CheckpointStreamErrorStore>()(() => ({
  checkpointStreamError: null,
}));
