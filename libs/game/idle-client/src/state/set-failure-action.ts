import type { ActivityFailureAction } from '@vers/idle-core';
import { useFailureActionStore } from './use-failure-action-store';

export function setFailureAction(failureAction: ActivityFailureAction) {
  useFailureActionStore.setState(() => ({ failureAction }));
}
