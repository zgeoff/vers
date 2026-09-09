interface BuildCSPHeaderValueOptions {
  readonly nonce: string;
  readonly sentryOrigin: string | null;
}

export function buildCSPHeaderValue(options: BuildCSPHeaderValueOptions): string {
  const connectSrc = ["'self'", options.sentryOrigin].filter(
    (value): value is string => value !== null,
  );

  // script-src carries no 'unsafe-eval': the only string evaluation in the bundle is zod's JIT probe,
  // which the client and worker entries turn off before any schema loads
  const directives: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ['connect-src', connectSrc],
    ['font-src', ["'self'"]],
    ['frame-src', ["'self'"]],
    ['img-src', ["'self'", 'data:']],
    ['media-src', ["'self'", 'data:']],
    ['script-src', ["'strict-dynamic'", "'self'", `'nonce-${options.nonce}'`]],
    ['script-src-attr', [`'nonce-${options.nonce}'`]],
  ];

  return directives.map(([directive, values]) => `${directive} ${values.join(' ')}`).join('; ');
}
