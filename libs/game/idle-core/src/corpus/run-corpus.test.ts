import { expect, test } from 'bun:test';
import { CORPUS_CASES } from './corpus-cases';
import { runCorpus } from './run-corpus';

test('it produces a frozen digest for every corpus case', () => {
  expect(runCorpus()).resolves.toMatchInlineSnapshot(`
    [
      {
        "digest": "f413fb841ddd3d4783a14ccce6f421712b4a44aca3d7b36ffcbc1dd62e9661ff",
        "id": "clean-completion",
      },
      {
        "digest": "2918e20c559a61a78f1389b03eb5cb60d96d86e6f6ff2146116506b3191c2143",
        "id": "aborted-failure",
      },
      {
        "digest": "00b0d10fbbcacb67510b82694970cb2e387d0d8fa6c02462628b052f86f0a540",
        "id": "same-tick-multi-enemy-avatar-death",
      },
      {
        "digest": "367f471551ace11e2c9a2d9cbb406ecba39c40043bded61b433fe1e89adbb1d0",
        "id": "retrying-multi-attempt",
      },
      {
        "digest": "eadd6b279ecb39af917c7925627aebd0e98db57781aaa47cde27b04245057dad",
        "id": "multi-clear",
      },
      {
        "digest": "46f035eacda430f0d00557fdb3b3f50e1e09aded9a3e3ec7b5691657972d543e",
        "id": "event-tie-failed-short",
      },
      {
        "digest": "ded6201cae0e9b6a4586aea014f4c5a1dd934064a6d48fbe229eeefd59664548",
        "id": "event-tie-failed-long",
      },
      {
        "digest": "0886286783f63206f75e2455b21b8af5609a7d06049cf84bdb9206c48c86c30e",
        "id": "event-tie-progress-cutoff",
      },
      {
        "digest": "d0d334a83466a69c4103d888ca7ba67b4bc80f4fc689931b3c2db7fbdae6bf80",
        "id": "threshold-one-below",
      },
      {
        "digest": "d1035218f885a10f2e80e43967b3be39d290533fbb5a2aaf5e41b8e3919385f4",
        "id": "threshold-exact",
      },
      {
        "digest": "7b6efa08f1d18f24a437ce5bec2ea8de547ba98ebb2676acb954c40862f710a8",
        "id": "repeated-retry-long-a",
      },
      {
        "digest": "048803f7a833d05148e81fc9efd74f5af15cdda86f192ee12b1d00bef142fb0d",
        "id": "repeated-retry-long-b",
      },
    ]
  `);
});

test('it produces the same digests on a repeated run', async () => {
  const first = await runCorpus();
  const second = await runCorpus();

  expect(first).toStrictEqual(second);
});

test('it covers every corpus case exactly once', async () => {
  const digests = await runCorpus();

  expect(digests.map((entry) => entry.id)).toIncludeSameMembers(
    CORPUS_CASES.map((corpusCase) => corpusCase.id),
  );

  expect(new Set(digests.map((entry) => entry.id)).size).toBe(CORPUS_CASES.length);
});
