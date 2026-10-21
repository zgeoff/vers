import { z } from 'zod';
import type { Json } from './types';

// postgres.js writes jsonb through JSON.stringify, which drops undefined members and turns a Date
// into a string; z.json() rejects both, so the value takes the same round trip first
export function toJSON(value: Readonly<Record<string, unknown>>): Json {
  const text = JSON.stringify(value);

  return z.json().parse(JSON.parse(text));
}
