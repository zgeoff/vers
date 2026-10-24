import { expect, test } from 'bun:test';
import { parseArchiveConfig } from './parse-archive-config';

test('it reads the archive config from the four archive keys', () => {
  expect(
    parseArchiveConfig({
      CHECKPOINT_ARCHIVE_ACCESS_KEY_ID: 'key-id',
      CHECKPOINT_ARCHIVE_BUCKET: 'vers-checkpoints',
      CHECKPOINT_ARCHIVE_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      CHECKPOINT_ARCHIVE_SECRET_ACCESS_KEY: 'secret',
    }),
  ).toStrictEqual({
    config: {
      accessKeyID: 'key-id',
      bucket: 'vers-checkpoints',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      secretAccessKey: 'secret',
    },
    kind: 'ready',
  });
});

test('it names each key that is unset or empty', () => {
  expect(
    parseArchiveConfig({
      CHECKPOINT_ARCHIVE_ACCESS_KEY_ID: '',
      CHECKPOINT_ARCHIVE_BUCKET: 'vers-checkpoints',
      CHECKPOINT_ARCHIVE_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    }),
  ).toStrictEqual({
    kind: 'missing',
    missingKeys: ['CHECKPOINT_ARCHIVE_ACCESS_KEY_ID', 'CHECKPOINT_ARCHIVE_SECRET_ACCESS_KEY'],
  });
});
