export interface FastClock {
  readonly jump: (deltaMs: number) => void;

  readonly now: () => number;
}

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
