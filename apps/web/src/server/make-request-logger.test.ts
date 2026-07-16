import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { makeRequestLogger } from './make-request-logger';

test('it logs one structured line at info when a page request completes', async () => {
  const lines: Array<{ fields: Record<string, unknown>; level: string; message: string }> = [];

  const requestLogger = makeRequestLogger({
    debug: (fields, message) => {
      lines.push({ fields, level: 'debug', message });
    },
    error: (fields, message) => {
      lines.push({ fields, level: 'error', message });
    },
    info: (fields, message) => {
      lines.push({ fields, level: 'info', message });
    },
    warn: (fields, message) => {
      lines.push({ fields, level: 'warn', message });
    },
  });

  const response = await requestLogger(new Request('https://example.test/nexus'), () =>
    Promise.resolve(new Response('ok')),
  );

  expect(response.status).toBe(200);
  expect(lines).toHaveLength(1);
  invariant(lines[0], 'one line was logged');

  expect(lines[0]).toStrictEqual({
    fields: {
      durationMs: expect.toBeNumber(),
      method: 'GET',
      path: '/nexus',
      status: 200,
    },
    level: 'info',
    message: 'request completed',
  });
});

test('it includes the query string in the logged path', async () => {
  const lines: Array<{ fields: Record<string, unknown>; level: string; message: string }> = [];

  const requestLogger = makeRequestLogger({
    debug: (fields, message) => {
      lines.push({ fields, level: 'debug', message });
    },
    error: (fields, message) => {
      lines.push({ fields, level: 'error', message });
    },
    info: (fields, message) => {
      lines.push({ fields, level: 'info', message });
    },
    warn: (fields, message) => {
      lines.push({ fields, level: 'warn', message });
    },
  });

  await requestLogger(new Request('https://example.test/login?next=/account'), () =>
    Promise.resolve(new Response('ok')),
  );

  invariant(lines[0], 'one line was logged');
  expect(lines[0].fields).toContainEntry(['path', '/login?next=/account']);
});

test('it logs a client error response at warn', async () => {
  const lines: Array<{ fields: Record<string, unknown>; level: string; message: string }> = [];

  const requestLogger = makeRequestLogger({
    debug: (fields, message) => {
      lines.push({ fields, level: 'debug', message });
    },
    error: (fields, message) => {
      lines.push({ fields, level: 'error', message });
    },
    info: (fields, message) => {
      lines.push({ fields, level: 'info', message });
    },
    warn: (fields, message) => {
      lines.push({ fields, level: 'warn', message });
    },
  });

  await requestLogger(new Request('https://example.test/missing'), () =>
    Promise.resolve(new Response('nope', { status: 404 })),
  );

  invariant(lines[0], 'one line was logged');
  expect(lines[0].level).toBe('warn');
  expect(lines[0].fields).toContainEntry(['status', 404]);
});

test('it logs a server error response at error', async () => {
  const lines: Array<{ fields: Record<string, unknown>; level: string; message: string }> = [];

  const requestLogger = makeRequestLogger({
    debug: (fields, message) => {
      lines.push({ fields, level: 'debug', message });
    },
    error: (fields, message) => {
      lines.push({ fields, level: 'error', message });
    },
    info: (fields, message) => {
      lines.push({ fields, level: 'info', message });
    },
    warn: (fields, message) => {
      lines.push({ fields, level: 'warn', message });
    },
  });

  await requestLogger(new Request('https://example.test/nexus'), () =>
    Promise.resolve(new Response('boom', { status: 500 })),
  );

  invariant(lines[0], 'one line was logged');
  expect(lines[0].level).toBe('error');
  expect(lines[0].fields).toContainEntry(['status', 500]);
});

test('it logs a served static asset at debug', async () => {
  const lines: Array<{ fields: Record<string, unknown>; level: string; message: string }> = [];

  const requestLogger = makeRequestLogger({
    debug: (fields, message) => {
      lines.push({ fields, level: 'debug', message });
    },
    error: (fields, message) => {
      lines.push({ fields, level: 'error', message });
    },
    info: (fields, message) => {
      lines.push({ fields, level: 'info', message });
    },
    warn: (fields, message) => {
      lines.push({ fields, level: 'warn', message });
    },
  });

  await requestLogger(new Request('https://example.test/assets/app-3f2a.js'), () =>
    Promise.resolve(new Response('js', { status: 200 })),
  );

  invariant(lines[0], 'one line was logged');
  expect(lines[0].level).toBe('debug');
});

test('it logs a missing asset at warn rather than debug', async () => {
  const lines: Array<{ fields: Record<string, unknown>; level: string; message: string }> = [];

  const requestLogger = makeRequestLogger({
    debug: (fields, message) => {
      lines.push({ fields, level: 'debug', message });
    },
    error: (fields, message) => {
      lines.push({ fields, level: 'error', message });
    },
    info: (fields, message) => {
      lines.push({ fields, level: 'info', message });
    },
    warn: (fields, message) => {
      lines.push({ fields, level: 'warn', message });
    },
  });

  await requestLogger(new Request('https://example.test/assets/gone.js'), () =>
    Promise.resolve(new Response('nope', { status: 404 })),
  );

  invariant(lines[0], 'one line was logged');
  expect(lines[0].level).toBe('warn');
});

test('it logs at error and rethrows when the handler throws', async () => {
  const lines: Array<{ fields: Record<string, unknown>; level: string; message: string }> = [];

  const requestLogger = makeRequestLogger({
    debug: (fields, message) => {
      lines.push({ fields, level: 'debug', message });
    },
    error: (fields, message) => {
      lines.push({ fields, level: 'error', message });
    },
    info: (fields, message) => {
      lines.push({ fields, level: 'info', message });
    },
    warn: (fields, message) => {
      lines.push({ fields, level: 'warn', message });
    },
  });

  const thrown = new Error('handler exploded');

  const pending = requestLogger(new Request('https://example.test/nexus'), () =>
    Promise.reject(thrown),
  );

  expect(pending).rejects.toBe(thrown);

  await expect(pending).toReject();

  expect(lines).toHaveLength(1);
  invariant(lines[0], 'one line was logged');

  expect(lines[0]).toStrictEqual({
    fields: {
      durationMs: expect.toBeNumber(),
      err: thrown,
      method: 'GET',
      path: '/nexus',
    },
    level: 'error',
    message: 'request failed',
  });
});
