/**
 * Why a bounded fetch attempt failed before a response arrived: `'transport'` means the request
 * never reached the server, so nothing applied and retrying is safe for any method; `'timeout'`
 * means the attempt's own bound fired, so the server may already have received and processed the
 * request.
 */
export type OutboundFailureMode = 'timeout' | 'transport';
