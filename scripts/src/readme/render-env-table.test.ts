import { expect, test } from 'bun:test';
import { renderEnvTable } from './render-env-table';

test('it renders presence as required, optional, or the default value', () => {
  const table = renderEnvTable(
    [
      { description: 'connection string', key: 'DATABASE_URL', required: true },
      { defaultValue: 'info', description: '', key: 'LOG_LEVEL', required: false },
      { description: '', key: 'SENTRY_DSN', required: false },
    ],
    { includePresence: true },
  );

  expect(table).toBe(
    [
      '| Variable       | Presence       | Description       |',
      '| -------------- | -------------- | ----------------- |',
      '| `DATABASE_URL` | required       | connection string |',
      '| `LOG_LEVEL`    | default `info` | —                 |',
      '| `SENTRY_DSN`   | optional       | —                 |',
    ].join('\n'),
  );
});

test('it drops the presence column for rows without presence information', () => {
  const table = renderEnvTable(
    [{ description: 'zone access token', key: 'CLOUDFLARE_API_TOKEN', required: true }],
    { includePresence: false },
  );

  expect(table).toBe(
    [
      '| Variable               | Description       |',
      '| ---------------------- | ----------------- |',
      '| `CLOUDFLARE_API_TOKEN` | zone access token |',
    ].join('\n'),
  );
});
