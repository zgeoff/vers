import path from 'node:path';
import invariant from 'tiny-invariant';

const BUNDLED_CONTENT_VERSION_MODULE_PATH = path.resolve(
  import.meta.dirname,
  '../../../libs/game/worldmap-content/src/bundled-content-version.ts',
);

/**
 * Reads `BUNDLED_CONTENT_VERSION` straight from its source module by file path rather than a
 * workspace import — `@vers/worldmap-content` is server-only game content code, and the deploy CLI
 * must not link against it to read one build-time constant.
 */
export async function loadBundledContentVersion(): Promise<string> {
  const contentModule: unknown = await import(BUNDLED_CONTENT_VERSION_MODULE_PATH);

  invariant(
    hasBundledContentVersion(contentModule),
    'bundled-content-version.ts must export BUNDLED_CONTENT_VERSION as a string',
  );

  return contentModule.BUNDLED_CONTENT_VERSION;
}

function hasBundledContentVersion(
  value: unknown,
): value is { readonly BUNDLED_CONTENT_VERSION: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { BUNDLED_CONTENT_VERSION?: unknown }).BUNDLED_CONTENT_VERSION === 'string'
  );
}
