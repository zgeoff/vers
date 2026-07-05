import * as matchers from 'jest-extended';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './src/mocks/node';

expect.extend(matchers);

// oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
beforeAll(() => server.listen());

// oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
afterEach(() => server.resetHandlers());

// oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
afterAll(() => server.close());

server.events.on('request:start', (event) => {
  console.log('Outgoing:', event.request.method, event.request.url);
});
