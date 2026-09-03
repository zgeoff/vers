import path from 'node:path';
import { pathToFileURL } from 'node:url';
import invariant from 'tiny-invariant';
import type * as z from 'zod';

export async function loadEnvShape(serviceDir: string): Promise<z.ZodRawShape> {
  const shapePath = path.resolve(serviceDir, 'src/env-shape.ts');

  const shapeModule: unknown = await import(pathToFileURL(shapePath).href);

  invariant(
    isEnvShapeModule(shapeModule),
    `${shapePath} must export an \`envShape\` object of zod schemas`,
  );

  return shapeModule.envShape;
}

function isEnvShapeModule(value: unknown): value is { envShape: z.ZodRawShape } {
  if (typeof value !== 'object' || value === null || !('envShape' in value)) {
    return false;
  }

  const shape = value.envShape;

  if (typeof shape !== 'object' || shape === null) {
    return false;
  }

  return Object.values(shape).every((schema) => isZodSchemaLike(schema));
}

function isZodSchemaLike(schema: unknown): boolean {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'safeParse' in schema &&
    typeof schema.safeParse === 'function'
  );
}
