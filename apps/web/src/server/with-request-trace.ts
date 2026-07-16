import { withTraceContext } from '@vers/service-utils';
import { createTraceContext, parseTraceparent } from '@vers/trace';

/**
 * Runs the request inside its W3C trace-context scope: a valid inbound `traceparent` continues the
 * caller's trace, anything else starts a fresh one for this hop. Readers of the ambient scope —
 * server log lines, outbound service-call headers — then carry the request's trace id, and the
 * response reports it in `x-trace-id` so a support report can name the trace.
 */
export function withRequestTrace(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const trace = createTraceContext(
    parseTraceparent(request.headers.get('traceparent')) ?? undefined,
  );

  return withTraceContext(trace, async () => {
    const response = await next();

    try {
      response.headers.set('x-trace-id', trace.traceID);
    } catch {
      // a response built by Response.redirect or Response.error carries immutable headers; those
      // still correlate through the request log lines, so pass them through unstamped
    }

    return response;
  });
}
