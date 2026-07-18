import type { ActivityFailureAction } from '@vers/idle-core';
import { useIdleStore } from './use-idle-store';

export function setFailureAction(failureAction: ActivityFailureAction) {
  useIdleStore.setState(() => ({ failureAction }));
}
