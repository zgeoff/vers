import * as matchers from 'jest-extended';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './src/mocks/node';

expect.extend(matchers);

beforeAll(() => server.listen());

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

server.events.on('request:start', (event) => {
  console.log('Outgoing:', event.request.method, event.request.url);
});
