import './disable-zod-jit';
import { expect, test } from 'bun:test';
import * as z from 'zod';

test('it tells zod to skip its eval probe', () => {
  expect(z.config().jitless).toBe(true);
});
