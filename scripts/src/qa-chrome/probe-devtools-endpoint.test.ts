import { expect, test } from 'bun:test';
import { claimFreePorts } from '@zgeoff/testing/process';
import { startStubServer } from '@zgeoff/testing/server';
import { probeDevToolsEndpoint } from './probe-devtools-endpoint';

test('it finds an endpoint that answers the version request', async () => {
  const server = startStubServer(() => Response.json({ Browser: 'Chrome/152.0.0.0' }));

  const isFound = await probeDevToolsEndpoint(Number(new URL(server.url).port));

  expect(isFound).toBeTrue();
});

test('it finds no endpoint when the port refuses the version request', async () => {
  const server = startStubServer(() => new Response(null, { status: 404 }));

  const isFound = await probeDevToolsEndpoint(Number(new URL(server.url).port));

  expect(isFound).toBeFalse();
});

test('it finds no endpoint when the connection fails', async () => {
  const port = claimFreePorts(1).take();

  const isFound = await probeDevToolsEndpoint(port);

  expect(isFound).toBeFalse();
});
