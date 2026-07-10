import { AsyncLocalStorage } from 'node:async_hooks';
import type { TraceContext } from './types';

/**
 * Process-wide holder for the active request's trace context. Written only by
 * `withTraceContext`; read anywhere via `findTraceContext` — including pino mixins, so every log
 * line inside a request carries its trace id without threading it through call signatures.
 */
export const traceStorage = new AsyncLocalStorage<TraceContext>();
