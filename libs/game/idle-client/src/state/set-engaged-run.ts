import type { LiveRun } from '../worker/live-run-schema';
import { useIdleStore } from './use-idle-store';

export function setEngagedRun(engagedRun: LiveRun | null) {
  useIdleStore.setState(() => ({ engagedRun }));
}
