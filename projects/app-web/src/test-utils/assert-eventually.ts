/**
 * Polls an assertion outside React's `act` wrapping until it passes, rethrowing its last failure
 * once the timeout lapses. For state transitions driven by promises `act` cannot observe settling
 * (a thrown redirect's own navigation); RTL's `waitFor` covers everything else.
 */
export async function assertEventually(check: () => void, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      check();

      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}
