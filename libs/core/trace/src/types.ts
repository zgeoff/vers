/**
 * W3C Trace Context identity for one request hop: `traceID` names the end-to-end trace and is
 * shared by every service the request touches; `spanID` names this process's hop within it.
 */
export interface TraceContext {
  spanID: string;
  traceID: string;
}
