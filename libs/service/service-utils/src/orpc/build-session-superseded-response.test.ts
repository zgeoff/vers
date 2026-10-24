import { expect, test } from 'bun:test';
import { createORPCClient, isDefinedError, safe } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { oc } from '@orpc/contract';
import * as z from 'zod';
import { buildSessionSupersededResponse } from './build-session-superseded-response';

function setupTest() {
  return {
    // the transport the link sends through: app-web's proxy answering a superseded session
    sendRequest: () => Promise.resolve(buildSessionSupersededResponse()),
  };
}

test('it decodes as a defined UNAUTHORIZED for a missing session on an RPC client', async () => {
  const contract = {
    readNote: oc
      .errors({ UNAUTHORIZED: { data: z.object({ reason: z.string() }) } })
      .input(z.object({ noteID: z.string() }))
      .output(z.object({ title: z.string() })),
  };

  const ctx = setupTest();

  const client: ContractRouterClient<typeof contract> = createORPCClient(
    new RPCLink({ fetch: ctx.sendRequest, url: 'http://app.test/api/rpc/notes' }),
  );

  const [error] = await safe(client.readNote({ noteID: 'note_1' }));

  expect(isDefinedError(error)).toBeTrue();
  expect(error).toMatchObject({ code: 'UNAUTHORIZED', data: { reason: 'missing-session' } });
});

test('it marks the refusal with the session-superseded header', () => {
  const response = buildSessionSupersededResponse();

  expect(response.status).toBe(401);
  expect(response.headers.get('x-session-superseded')).toBe('1');
});
