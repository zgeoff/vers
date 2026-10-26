import { expect, test } from 'bun:test';
import { collectFileOPReferences } from './collect-file-op-references';

test.each([
  [
    'a single-quoted YAML scalar with a doubled quote',
    '.github/workflows/ci.yml',
    "env:\n  TOKEN: 'op://ops/Billing''s Portal/token'\n",
    "Billing's Portal",
  ],
  [
    'a double-quoted YAML scalar with an escaped quote',
    '.github/workflows/ci.yml',
    String.raw`env:
  TOKEN: "op://ops/the \"prod\" item/token"
`,
    'the "prod" item',
  ],
  [
    'a plain YAML scalar with spaces',
    '.github/workflows/ci.yaml',
    'env:\n  TOKEN: op://ops/Billing Portal/token\n',
    'Billing Portal',
  ],
  [
    'a YAML block literal holding a shell line',
    '.github/workflows/ci.yml',
    "steps:\n  - run: |\n      op read 'op://ops/billing/token' > token.txt\n",
    'billing',
  ],
  [
    'a folded YAML scalar holding a shell line',
    '.github/workflows/ci.yml',
    'steps:\n  - run: >\n      op read\n      op://ops/billing/token\n',
    'billing',
  ],
  [
    'a JSON shell string with an escaped quote',
    '.mcp.json',
    String.raw`{"args":["-c","op read \"op://ops/billing/token\""]}`,
    'billing',
  ],
  [
    'a JSON argument that is one reference with an apostrophe',
    '.mcp.json',
    `{"args":["read","op://ops/Billing's Portal/token"]}`,
    "Billing's Portal",
  ],
  ['an env file line', 'infra/.env.example', "TOKEN='op://ops/billing/token'\n", 'billing'],
])('it collects the reference from %s', (_form, path, text, item) => {
  expect(collectFileOPReferences(path, text)).toStrictEqual({
    references: [{ field: 'token', item, vault: 'ops' }],
    unparsed: [],
  });
});

test('it reads nothing from a YAML comment', () => {
  expect(
    collectFileOPReferences(
      '.github/workflows/ci.yml',
      '# reads op://ops/billing/token\nname: ci\n',
    ),
  ).toStrictEqual({ references: [], unparsed: [] });
});

test('it reports a YAML value that is a reference with no field as unparsed', () => {
  expect(
    collectFileOPReferences('.github/workflows/ci.yml', 'env:\n  TOKEN: op://ops/billing\n'),
  ).toStrictEqual({ references: [], unparsed: ['op://ops/billing'] });
});

test('it rejects a workflow that is not valid YAML', () => {
  expect(() =>
    collectFileOPReferences('.github/workflows/ci.yml', 'env: [unclosed\n'),
  ).toThrowWithMessage(Error, /\.github\/workflows\/ci\.yml is not valid YAML/u);
});
