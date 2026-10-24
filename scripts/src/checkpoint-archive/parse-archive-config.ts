import type { ArchiveConfig } from './types';

type ArchiveConfigResult =
  | { readonly config: ArchiveConfig; readonly kind: 'ready' }
  | { readonly kind: 'missing'; readonly missingKeys: Array<string> };

const ARCHIVE_ENV_KEYS = {
  accessKeyID: 'CHECKPOINT_ARCHIVE_ACCESS_KEY_ID',
  bucket: 'CHECKPOINT_ARCHIVE_BUCKET',
  endpoint: 'CHECKPOINT_ARCHIVE_ENDPOINT',
  secretAccessKey: 'CHECKPOINT_ARCHIVE_SECRET_ACCESS_KEY',
} as const;

export function parseArchiveConfig(
  env: Readonly<Record<string, string | undefined>>,
): ArchiveConfigResult {
  const accessKeyID = env[ARCHIVE_ENV_KEYS.accessKeyID] ?? '';
  const bucket = env[ARCHIVE_ENV_KEYS.bucket] ?? '';
  const endpoint = env[ARCHIVE_ENV_KEYS.endpoint] ?? '';
  const secretAccessKey = env[ARCHIVE_ENV_KEYS.secretAccessKey] ?? '';
  const missingKeys = Object.values(ARCHIVE_ENV_KEYS).filter((key) => (env[key] ?? '') === '');

  if (missingKeys.length > 0) {
    return { kind: 'missing', missingKeys };
  }

  return { config: { accessKeyID, bucket, endpoint, secretAccessKey }, kind: 'ready' };
}
