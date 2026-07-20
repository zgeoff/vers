import { expect, test } from 'bun:test';
import { renderEnvContract } from './render-env-contract';

test('it renders single-line key arrays with a trailing newline', () => {
  const rendered = renderEnvContract({
    optional: ['LOG_LEVEL', 'PORT'],
    required: ['DATABASE_URL'],
  });

  expect(rendered).toBe(
    '{\n  "optional": ["LOG_LEVEL", "PORT"],\n  "required": ["DATABASE_URL"]\n}\n',
  );
});

test('it renders empty key lists as empty arrays', () => {
  const rendered = renderEnvContract({ optional: [], required: [] });

  expect(rendered).toBe('{\n  "optional": [],\n  "required": []\n}\n');
});
