interface MakePlayElapsedOptions {
  readonly now: () => number;
  readonly signal: AbortSignal;
}

// the time a player has played, frozen when the stop signal fires, so a flush still in flight at
// the stop mints and delivers no simulated time past it
export function makePlayElapsed(options: Readonly<MakePlayElapsedOptions>): () => number {
  const startedAt = options.now();
  let stoppedAt = options.signal.aborted ? startedAt : undefined;

  options.signal.addEventListener(
    'abort',
    () => {
      stoppedAt = options.now();
    },
    { once: true },
  );

  return () => (stoppedAt ?? options.now()) - startedAt;
}
