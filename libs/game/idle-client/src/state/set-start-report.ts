import type { StartReport } from '../types';
import { useIdleStore } from './use-idle-store';

export function setStartReport(startReport: Readonly<StartReport>) {
  useIdleStore.setState(() => ({ startReport }));
}
