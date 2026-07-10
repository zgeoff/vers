interface BuildCSPHeaderValueOptions {
  readonly nonce: string;
  readonly sentryOrigin: string | null;
}

/**
 * Builds the app's Content-Security-Policy directive string for one request's nonce. `connect-src`
 * additionally allows the error-ingest origin when one is configured — the browser posts error
 * envelopes directly to it.
 */
export function buildCSPHeaderValue(options: BuildCSPHeaderValueOptions): string {
  const connectSrc = ["'self'", options.sentryOrigin].filter(
    (value): value is string => value !== null,
  );

  const directives: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ['connect-src', connectSrc],
    ['font-src', ["'self'"]],
    ['frame-src', ["'self'"]],
    ['img-src', ["'self'", 'data:']],
    ['media-src', ["'self'", 'data:']],
    ['script-src', ["'unsafe-eval'", "'strict-dynamic'", "'self'", `'nonce-${options.nonce}'`]],
    ['script-src-attr', [`'nonce-${options.nonce}'`]],
  ];

  return directives.map(([directive, values]) => `${directive} ${values.join(' ')}`).join('; ');
}
