import { expect, test } from 'bun:test';
import { createTraceparent } from './create-traceparent';

test('it mints a version-00 sampled traceparent carrying the returned trace id', () => {
  const minted = createTraceparent();

  expect(minted.traceID).toMatch(/^[0-9a-f]{32}$/);
  expect(minted.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  expect(minted.traceparent).toInclude(minted.traceID);
});

test('it mints a distinct trace per call', () => {
  expect(createTraceparent().traceID).not.toBe(createTraceparent().traceID);
});
