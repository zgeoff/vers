import type { TraceContext } from '@vers/trace';
import { getTraceStorage } from './get-trace-storage';

export function withTraceContext<T>(trace: Readonly<TraceContext>, scope: () => T): T {
  return getTraceStorage().run(trace, scope);
}
