interface BuildCSPHeaderValueOptions {
  readonly nonce: string;
  readonly sentryEnabled: boolean;
}

/**
 * Builds the app's Content-Security-Policy directive string for one request's nonce. `connect-src`
 * additionally allows Sentry's ingest origin when error reporting is configured.
 */
export function buildCSPHeaderValue(options: BuildCSPHeaderValueOptions): string {
  const connectSrc = ["'self'", options.sentryEnabled ? '*.sentry.io' : null].filter(
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
