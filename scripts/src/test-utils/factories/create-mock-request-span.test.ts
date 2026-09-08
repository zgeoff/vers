import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createMockRequestSpan } from './create-mock-request-span';

test('it builds a default routed request span that answered with success', () => {
  const span = createMockRequestSpan();

  invariant(span.path !== null, 'the default span carries a path');

  expect(span).toStrictEqual({
    name: expect.toEndWith(span.path),
    path: expect.toStartWith('/'),
    service: expect.toStartWith('service-'),
    statusCode: expect.toBeWithin(200, 300),
    traceID: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const span = createMockRequestSpan({ name: 'HTTP GET', path: null, statusCode: null });

  expect(span).toStrictEqual({
    name: 'HTTP GET',
    path: null,
    service: expect.toStartWith('service-'),
    statusCode: null,
    traceID: expect.toBeString(),
  });
});
