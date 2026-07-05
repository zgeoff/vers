import type { WritableDraft } from 'immer';

export type SetEntityStateFn<S extends object> = (state: WritableDraft<S>) => void;
