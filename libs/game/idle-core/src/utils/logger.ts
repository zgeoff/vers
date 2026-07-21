const isDebugEnabled = false;

export const logger = {
  /**
   * Invokes `buildMessage` only when debug logging is enabled, so callers can defer string
   * construction to the call site instead of paying for it on every invocation.
   */
  debug: (buildMessage: () => string) => {
    if (isDebugEnabled) {
      console.log(buildMessage());
    }
  },
  info: (message: string) => {
    console.log(message);
  },
};
