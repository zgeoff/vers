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

test.each([
  [
    'an MCP command that assigns a substituted single-quoted reference',
    '.mcp.json',
    String.raw`{"command":"sh","args":["-c","TRACKER_TOKEN=\"$(op read 'op://ops/tracker/mcp-token')\" exec ./tracker-mcp"]}`,
    [{ field: 'mcp-token', item: 'tracker', vault: 'ops' }],
  ],
  [
    'an MCP command with a substitution inside a quoted URL',
    '.mcp.json',
    String.raw`{"args":["-c","exec ./bridge \"https://bridge.example?token=$(op read 'op://ops/metrics/read-token')&host=https://api.example\""]}`,
    [{ field: 'read-token', item: 'metrics', vault: 'ops' }],
  ],
  [
    'an MCP command that assigns two substituted references',
    '.mcp.json',
    String.raw`{"args":["-c","PANEL_USER=\"$(op read 'op://ops/panel/username')\" PANEL_PASS=\"$(op read 'op://ops/panel/password')\" exec ./panel"]}`,
    [
      { field: 'username', item: 'panel', vault: 'ops' },
      { field: 'password', item: 'panel', vault: 'ops' },
    ],
  ],
  [
    'an env file assignment',
    'infra/.env.example',
    'API_TOKEN=op://ops/infra/api-token\n',
    [{ field: 'api-token', item: 'infra', vault: 'ops' }],
  ],
  [
    'an env file comment that names the scheme',
    'infra/.env.example',
    '# every value is an op:// reference resolved by `op run --env-file=.env`\n',
    [],
  ],
  [
    'a workflow comment that names the scheme',
    '.github/workflows/ci.yml',
    'jobs:\n  check:\n    # every op:// reference the workflows read is listed\n    runs-on: ubuntu-latest\n',
    [],
  ],
  [
    'README prose that names the scheme in code spans',
    'infra/README.md',
    '- `.env` — `op://` references resolved by `op run`; `.env.example` is the full set.\n',
    [],
  ],
])('it reads the repo form of %s', (_form, path, text, references) => {
  expect(collectFileOPReferences(path, text)).toStrictEqual({ references, unparsed: [] });
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

test.each([
  [
    'a workflow env value built by a GitHub expression',
    `env:\n  TOKEN: op://\${{ vars.VAULT }}/billing/token\n`,
    `op://\${{ vars.VAULT }}/billing/token`,
  ],
  [
    'a workflow env value that is a GitHub expression holding a reference',
    `env:\n  TOKEN: \${{ format('op://{0}/billing/token', vars.VAULT) }}\n`,
    `\${{ format('op://{0}/billing/token', vars.VAULT) }}`,
  ],
  [
    'a workflow run step with a GitHub expression inside the reference',
    `steps:\n  - run: op read "op://\${{ vars.VAULT }}/billing/token"\n`,
    'op://$/billing/token',
  ],
])('it reports %s as unparsed', (_form, text, scanned) => {
  expect(collectFileOPReferences('.github/workflows/ci.yml', text)).toStrictEqual({
    references: [],
    unparsed: [scanned],
  });
});

test('it rejects a workflow that is not valid YAML', () => {
  expect(() =>
    collectFileOPReferences('.github/workflows/ci.yml', 'env: [unclosed\n'),
  ).toThrowWithMessage(Error, /\.github\/workflows\/ci\.yml is not valid YAML/u);
});
