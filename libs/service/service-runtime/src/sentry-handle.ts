interface ErrorReportScope {
  readonly setTag: (key: string, value: string) => unknown;
}

interface ErrorReporter {
  readonly captureException: (error: unknown) => unknown;
  readonly flush: (timeoutMs: number) => Promise<boolean>;
  readonly withScope: (callback: (scope: ErrorReportScope) => void) => unknown;
}

export const sentryHandle: { current: ErrorReporter | undefined } = { current: undefined };
