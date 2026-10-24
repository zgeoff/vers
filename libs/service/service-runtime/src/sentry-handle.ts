interface ErrorReportContext {
  readonly tags: Readonly<Record<string, string>>;
}

interface ErrorReporter {
  readonly captureException: (error: unknown, context?: ErrorReportContext) => unknown;
  readonly flush: (timeoutMs: number) => Promise<boolean>;
}

export const sentryHandle: { current: ErrorReporter | undefined } = { current: undefined };
