import { expect, test } from 'bun:test';
import { S3Client } from 'bun';
import invariant from 'tiny-invariant';
import { startStubS3 } from './start-stub-s3';

function setupTest(options: Parameters<typeof startStubS3>[0] = {}) {
  const stub = startStubS3(options);

  const client = new S3Client({
    accessKeyId: 'stub-access-key',
    bucket: stub.bucket,
    endpoint: stub.endpoint,
    secretAccessKey: 'stub-secret-key',
  });

  return { client, stub };
}

test('it lists an object with the write time a test set on it', async () => {
  const ctx = setupTest();

  await ctx.client.write('checkpoints/avatar_a/act_a.jsonl.gz', 'one');

  ctx.stub.setLastModified(
    'checkpoints/avatar_a/act_a.jsonl.gz',
    new Date('2026-01-01T00:00:00.000Z'),
  );

  const listed = await ctx.client.list({ prefix: 'checkpoints/' });

  expect(listed.contents?.map((object) => object.lastModified)).toStrictEqual([
    '2026-01-01T00:00:00.000Z',
  ]);
});

test('it rejects a write time for an object it does not hold', () => {
  const ctx = setupTest();

  expect(() => {
    ctx.stub.setLastModified('checkpoints/avatar_a/act_missing.jsonl.gz', new Date());
  }).toThrowWithMessage(Error, /holds no object/u);
});

test('it returns the bytes an upload wrote', async () => {
  const ctx = setupTest();

  await ctx.client.write('checkpoints/avatar_a/act_a.jsonl.gz', new Uint8Array([1, 2, 3]));

  const read = await ctx.client.file('checkpoints/avatar_a/act_a.jsonl.gz').bytes();

  expect(read).toStrictEqual(new Uint8Array([1, 2, 3]));
});

test('it returns other bytes than an upload wrote when stored bodies are corrupted', async () => {
  const ctx = setupTest({ corruptStoredBodies: true });

  await ctx.client.write('checkpoints/avatar_a/act_a.jsonl.gz', new Uint8Array([1, 2, 3]));

  const read = await ctx.client.file('checkpoints/avatar_a/act_a.jsonl.gz').bytes();

  expect(read).toStrictEqual(new Uint8Array([2, 3]));
});

test('it reports a removed object as missing', async () => {
  const ctx = setupTest();

  await ctx.client.write('checkpoints/avatar_a/act_a.jsonl.gz', 'body');
  await ctx.client.delete('checkpoints/avatar_a/act_a.jsonl.gz');

  const exists = await ctx.client.exists('checkpoints/avatar_a/act_a.jsonl.gz');

  expect(exists).toBeFalse();
});

test('it rejects a read of an object that was never written', () => {
  const ctx = setupTest();

  expect(ctx.client.file('checkpoints/avatar_a/act_missing.jsonl.gz').bytes()).rejects.toThrow();
});

test('it lists the objects under a prefix with their write time', async () => {
  const ctx = setupTest();

  const before = new Date(Date.now() - 1000);

  await ctx.client.write('checkpoints/avatar_a/act_a.jsonl.gz', 'one');
  await ctx.client.write('other/file.txt', 'two');

  const listed = await ctx.client.list({ prefix: 'checkpoints/' });

  expect(listed.contents).toStrictEqual([
    expect.objectContaining({
      key: 'checkpoints/avatar_a/act_a.jsonl.gz',
      lastModified: expect.any(String),
    }),
  ]);

  expect(new Date(listed.contents?.[0]?.lastModified ?? 0)).toBeAfter(before);
});

test('it pages a listing longer than its page size', async () => {
  const ctx = setupTest({ pageSize: 1 });

  await ctx.client.write('checkpoints/avatar_a/act_a.jsonl.gz', 'one');
  await ctx.client.write('checkpoints/avatar_a/act_b.jsonl.gz', 'two');

  const first = await ctx.client.list({ prefix: 'checkpoints/' });

  invariant(first.nextContinuationToken !== undefined);

  const second = await ctx.client.list({
    continuationToken: first.nextContinuationToken,
    prefix: 'checkpoints/',
  });

  expect(first.isTruncated).toBeTrue();

  expect(second.contents?.map((object) => object.key)).toStrictEqual([
    'checkpoints/avatar_a/act_b.jsonl.gz',
  ]);

  expect(second.isTruncated).toBeFalse();
});
