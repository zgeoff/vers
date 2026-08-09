import { expect, test } from 'bun:test';
import type { ContentDocument } from '@vers/contract-activity';
import invariant from 'tiny-invariant';
import { parseContentDocumentSource } from './parse-content-document-source';

const VALID_DOCUMENT: ContentDocument = {
  contentVersion: '1',
  encounter: {
    contentVersion: '1',
    archetypes: [
      {
        id: 'archetype-a',
        name: 'Archetype A',
        baseLevel: 1,
        baseLife: 10,
        baseXP: 5,
        attackMin: 1,
        attackMax: 2,
        attackSpeed: 0.5,
      },
    ],
    pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  },
  loot: {
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  },
};

test('it parses valid document JSON', () => {
  const result = parseContentDocumentSource(JSON.stringify(VALID_DOCUMENT));

  expect(result).toStrictEqual({ kind: 'ok', document: VALID_DOCUMENT });
});

test('it reports malformed JSON as invalid-json', () => {
  const result = parseContentDocumentSource('{ not json');

  expect(result.kind).toBe('invalid-json');
});

test('it reports schema-invalid JSON as invalid-document, naming the issue path', () => {
  const result = parseContentDocumentSource(
    JSON.stringify({ ...VALID_DOCUMENT, loot: { ...VALID_DOCUMENT.loot, contentVersion: '2' } }),
  );

  invariant(result.kind === 'invalid-document', 'expected an invalid-document result');

  expect(result.message).toInclude('loot');
  expect(result.message).toInclude('contentVersion');
});
