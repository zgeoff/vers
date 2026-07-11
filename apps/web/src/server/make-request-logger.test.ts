import { expect, test } from 'bun:test';
import { makeRequestLogger } from './make-request-logger';

test('it logs one line before and one line after the request completes', async () => {
  const lines: Array<string> = [];

  const requestLogger = makeRequestLogger({
    info: (message) => {
      lines.push(message);
    },
  });

  const response = await requestLogger(new Request('https://example.test/nexus'), () =>
    Promise.resolve(new Response('ok')),
  );

  expect(response.status).toBe(200);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toInclude('GET /nexus processing...');
  expect(lines[1]).toInclude('GET');
  expect(lines[1]).toInclude('200');
});

test('it includes the query string in the logged path', async () => {
  const lines: Array<string> = [];

  const requestLogger = makeRequestLogger({
    info: (message) => {
      lines.push(message);
    },
  });

  await requestLogger(new Request('https://example.test/login?next=/account'), () =>
    Promise.resolve(new Response('ok')),
  );

  expect(lines[0]).toInclude('/login?next=/account');
});

test('it emits no escape codes when colorize is off', async () => {
  const lines: Array<string> = [];

  const requestLogger = makeRequestLogger(
    {
      info: (message) => {
        lines.push(message);
      },
    },
    { colorize: false },
  );

  await requestLogger(new Request('https://example.test/nexus'), () =>
    Promise.resolve(new Response('ok')),
  );

  expect(lines).toHaveLength(2);
  expect(lines.join('')).not.toInclude('\u001B[');
  expect(lines[1]).toInclude('[--->] GET /nexus 200');
});

test('it labels a server error response distinctly from a success', async () => {
  const lines: Array<string> = [];

  const requestLogger = makeRequestLogger({
    info: (message) => {
      lines.push(message);
    },
  });

  await requestLogger(new Request('https://example.test/nexus'), () =>
    Promise.resolve(new Response('boom', { status: 500 })),
  );

  expect(lines[1]).toInclude('SERVER ERROR');
});
