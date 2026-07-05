import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from 'jest-extended';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './app/mocks/node';

expect.extend(matchers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();

  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
