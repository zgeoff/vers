interface ArchiveHead {
  readonly archivedAt: Date | null;
}

export function canPurgeArchive(
  head: Readonly<ArchiveHead> | undefined,
  writtenBefore: Date,
): boolean {
  if (head === undefined) {
    return true;
  }

  return head.archivedAt !== null && head.archivedAt < writtenBefore;
}
