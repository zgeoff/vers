import { findArchivedActivityID } from './find-archived-activity-id';

interface ListedObject {
  readonly key: string;
  readonly lastModified?: string;
}

interface ExpiredArchive {
  readonly activityID: string;
  readonly key: string;
}

export function collectExpiredArchives(
  objects: ReadonlyArray<ListedObject>,
  writtenBefore: Date,
): Array<ExpiredArchive> {
  return objects.flatMap((object) => {
    const activityID = findArchivedActivityID(object.key);

    if (activityID === undefined || object.lastModified === undefined) {
      return [];
    }

    if (new Date(object.lastModified) >= writtenBefore) {
      return [];
    }

    return [{ activityID, key: object.key }];
  });
}
