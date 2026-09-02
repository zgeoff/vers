import type { TraceContext } from '@vers/trace';
import { getTraceStorage } from './get-trace-storage';

export function findTraceContext(): TraceContext | undefined {
  return getTraceStorage().getStore();
}
