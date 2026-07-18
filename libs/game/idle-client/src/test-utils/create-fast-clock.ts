export interface FastClock {
  /**
   * Arms the clock's very next read to jump forward by `deltaMs` instead of staying frozen — one
   * call through the runtime's tick loop then processes a whole `deltaMs` of simulated time.
   * Every other read returns the same frozen value, so a jump armed before the tick loop has
   * installed a simulation costs nothing (an idle tick with nowhere to apply it) rather than
   * cascading through however many continuations the frame would otherwise cover.
   */
  readonly jump: (deltaMs: number) => void;

  readonly now: () => number;
}

/**
 * A tick-loop clock for the worker runtime's `now` option. Lets a test collapse the loop's
 * real-time pacing into a single frame on demand, rather than waiting out an encounter's actual
 * simulated duration in real time.
 */
export function createFastClock(): FastClock {
  let value = 0;
  let pendingJumpMs = 0;

  return {
    jump: (deltaMs) => {
      pendingJumpMs = deltaMs;
    },
    now: () => {
      value += pendingJumpMs;
      pendingJumpMs = 0;

      return value;
    },
  };
}
