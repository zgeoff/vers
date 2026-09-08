import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import { workerContract } from '../worker/worker-contract';
import { workerToClientMessageSchema } from '../worker/worker-to-client-message-schema';

// the tab-to-worker contract and the worker-to-tab message schema, rendered as JSON Schema and
// digested: two builds agree on the stamp exactly when their wire shapes agree, so a writer can
// refuse a tab from another build without either side carrying a hand-bumped version
export function buildProtocolStamp(): string {
  const procedures = Object.entries(workerContract).map(([name, procedure]) => ({
    input: renderSchema(procedure['~orpc'].inputSchema),
    name,
    output: renderSchema(procedure['~orpc'].outputSchema),
  }));

  const rendered = JSON.stringify({
    messages: renderSchema(workerToClientMessageSchema),
    procedures,
  });

  return bytesToHex(sha256(utf8ToBytes(rendered)));
}

function renderSchema(schema: unknown): unknown {
  invariant(schema instanceof z.ZodType, 'every wire schema is a zod schema');

  return z.toJSONSchema(schema, { unrepresentable: 'any' });
}
