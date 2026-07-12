import { ActivityFailureAction } from '@vers/idle-core';
import { create } from 'zustand';

interface FailureActionStore {
  failureAction: ActivityFailureAction;
}

export const useFailureActionStore = create<FailureActionStore>()(() => ({
  failureAction: ActivityFailureAction.Abort,
}));
