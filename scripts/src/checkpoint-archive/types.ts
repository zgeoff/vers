import type { ActivityCheckpoints, DB } from '@vers/db';
import type { S3Client } from 'bun';
import type { Kysely, Selectable } from 'kysely';

export interface ArchiveCandidate {
  readonly activityID: string;
  readonly appendedHead: number;
  readonly avatarID: string;
}

export interface ArchiveConfig {
  readonly accessKeyID: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly secretAccessKey: string;
}

export interface CheckpointArchiveDeps {
  readonly bucket: S3Client;
  readonly db: Kysely<DB>;
}

export type CheckpointRow = Selectable<ActivityCheckpoints>;
