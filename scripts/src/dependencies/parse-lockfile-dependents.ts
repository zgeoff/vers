import { z } from 'zod';
import type { LockfileDependent } from './types';

const rangesSchema = z.record(z.string(), z.string()).optional();

const packageMetadataSchema = z.object({
  dependencies: rangesSchema,
  optionalDependencies: rangesSchema,
  peerDependencies: rangesSchema,
});

// A registry entry is [id, registry, metadata, integrity]; a workspace or link entry is shorter.
const packageEntrySchema = z.tuple([z.string()]).rest(z.unknown());
const lockfileSchema = z.object({ packages: z.record(z.string(), packageEntrySchema) });

export function parseLockfileDependents(lockfile: string): Array<LockfileDependent> {
  const parsed = lockfileSchema.parse(Bun.JSONC.parse(lockfile));

  return Object.values(parsed.packages).flatMap(([dependent, , metadata]) => {
    const declared = packageMetadataSchema.safeParse(metadata);

    if (!declared.success) {
      return [];
    }

    return [
      declared.data.dependencies,
      declared.data.optionalDependencies,
      declared.data.peerDependencies,
    ].flatMap((ranges) =>
      Object.entries(ranges ?? {}).map(([name, range]) => ({ dependent, name, range })),
    );
  });
}
