import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { server } from '../mocks/node';
import { probeDevToolsEndpoint } from './probe-devtools-endpoint';

test('it finds an endpoint that answers the version request', async () => {
  server.use(
    http.get('http://127.0.0.1:9333/json/version', () =>
      HttpResponse.json({ Browser: 'Chrome/152.0.0.0' }),
    ),
  );

  const isFound = await probeDevToolsEndpoint(9333);

  expect(isFound).toBeTrue();
});

test('it finds no endpoint when the port refuses the version request', async () => {
  server.use(
    http.get('http://127.0.0.1:9333/json/version', () => new HttpResponse(null, { status: 404 })),
  );

  const isFound = await probeDevToolsEndpoint(9333);

  expect(isFound).toBeFalse();
});

test('it finds no endpoint when the connection fails', async () => {
  server.use(http.get('http://127.0.0.1:9333/json/version', () => HttpResponse.error()));

  const isFound = await probeDevToolsEndpoint(9333);

  expect(isFound).toBeFalse();
});
