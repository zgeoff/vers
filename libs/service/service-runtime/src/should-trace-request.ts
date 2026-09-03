// Fly probes /health every few seconds and its suspend autostop freezes the process mid-span; on
// resume the server span reports the whole sleep gap as its duration, so an idle machine's probes
// would read as multi-second stalls that never happened
const UNTRACED_PATHS = new Set(['/health']);

export function shouldTraceRequest(request: Request): boolean {
  return !UNTRACED_PATHS.has(new URL(request.url).pathname);
}
