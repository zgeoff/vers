import type { ActivityData } from '@vers/contract-activity';

export function collectChainBlockedActivityIDs(
  starts: ReadonlyArray<Pick<ActivityData, 'id' | 'predecessorActivityID'>>,
  registeredActivityIDs: ReadonlySet<string>,
): ReadonlySet<string> {
  const pendingStartIDs = new Set(starts.map((start) => start.id));

  return new Set(
    starts
      .filter(
        (start) =>
          start.predecessorActivityID !== null &&
          (registeredActivityIDs.has(start.predecessorActivityID) ||
            pendingStartIDs.has(start.predecessorActivityID)),
      )
      .map((start) => start.id),
  );
}
