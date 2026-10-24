import invariant from 'tiny-invariant';

interface NextSeedCheckpoint {
  readonly payload: { readonly nextSeed: string };
}

// the last checkpoint's `nextSeed` is the driver's stop-at sanity check: a checkpoint's `time`
// resets on every engine restart within a farmed stream, so it can never size a duration to
// advance to
export function getStopAtState(checkpoints: ReadonlyArray<NextSeedCheckpoint>): string {
  const last = checkpoints.at(-1);

  invariant(last !== undefined, 'a replayed run always has at least one checkpoint');

  return last.payload.nextSeed;
}
