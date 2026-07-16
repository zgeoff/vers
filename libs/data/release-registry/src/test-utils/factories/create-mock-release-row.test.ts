import { expect, test } from 'bun:test';
import { createMockReleaseRow } from './create-mock-release-row';

test('it builds a default release row', () => {
  const row = createMockReleaseRow();

  expect(row).toStrictEqual({
    app: expect.toBeString(),
    deployedAt: expect.toBeValidDate(),
    gitSha: expect.toBeString(),
    id: expect.toBeString(),
    image: expect.toBeString(),
    imageDigest: expect.toStartWith('sha256:'),
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockReleaseRow({ app: 'vers-app-web', imageDigest: null });

  expect(row).toStrictEqual({
    app: 'vers-app-web',
    deployedAt: expect.toBeValidDate(),
    gitSha: expect.toBeString(),
    id: expect.toBeString(),
    image: expect.toBeString(),
    imageDigest: null,
  });
});
