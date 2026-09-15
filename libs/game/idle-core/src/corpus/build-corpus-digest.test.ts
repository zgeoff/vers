import { expect, test } from 'bun:test';
import { buildCorpusDigest } from './build-corpus-digest';

test('it produces a frozen digest for a known canonical string', () => {
  expect(buildCorpusDigest('{"id":"digest-fixture"}')).resolves.toMatchInlineSnapshot(
    `"544780ba0717cc730a453dd02e0d4258f51beb32d568628157e7fb76b2878002"`,
  );
});

test('it produces the same digest for a repeated call over the same input', async () => {
  const canonical = '{"id":"digest-repeat"}';

  const first = await buildCorpusDigest(canonical);
  const second = await buildCorpusDigest(canonical);

  expect(first).toStrictEqual(second);
});

test('it produces different digests for different canonical strings', async () => {
  const first = await buildCorpusDigest('{"id":"digest-a"}');
  const second = await buildCorpusDigest('{"id":"digest-b"}');

  expect(first).not.toBe(second);
});
