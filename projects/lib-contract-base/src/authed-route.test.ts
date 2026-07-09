import { expect, test } from 'bun:test';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import * as z from 'zod';
import { authedRoute } from './authed-route';

test('it declares UNAUTHORIZED and FORBIDDEN responses on a procedure built from authedRoute', async () => {
  const contract = {
    getThing: authedRoute
      .route({ method: 'GET', path: '/thing' })
      .output(z.object({ id: z.string() })),
  };

  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(contract, {
    info: { title: 'test', version: '0.0.0' },
  });

  const responses = document.paths?.['/thing']?.get?.responses;

  expect(responses).toContainKeys(['401', '403']);
});
