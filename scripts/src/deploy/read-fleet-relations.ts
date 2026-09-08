import { readCommitRelation } from './read-commit-relation';
import type { AppState, CommitRelation } from './types';

export async function readFleetRelations(
  state: AppState,
): Promise<Readonly<Record<string, CommitRelation>>> {
  const shas = new Set(
    state.machines.map((machine) => machine.gitSHA).filter((sha) => sha !== null),
  );

  const entries = await Promise.all(
    [...shas].map(async (sha) => [sha, await readCommitRelation(sha)] as const),
  );

  return Object.fromEntries(entries);
}
