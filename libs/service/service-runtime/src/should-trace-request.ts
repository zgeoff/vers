/**
 * Paths kept out of tracing. Fly probes `/health` every few seconds, and its `suspend` autostop
 * freezes the process mid-span: on resume the server span reports the whole sleep gap as its own
 * duration, so an idle machine's health checks read as multi-second event-loop stalls that never
 * happened.
 */
const UNTRACED_PATHS = new Set(['/health']);

/**
 * Decides whether the OTel plugin opens a span for a request, keyed on the request path.
 */
export function shouldTraceRequest(request: Request): boolean {
  return !UNTRACED_PATHS.has(new URL(request.url).pathname);
}
