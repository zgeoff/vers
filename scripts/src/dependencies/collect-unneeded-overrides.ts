import type { DependencyGateFinding, LockfileDependent } from './types';

interface UnneededOverridesInput {
  readonly overrides: Readonly<Record<string, string>>;
  readonly catalog: Readonly<Record<string, string>>;
  readonly dependents: ReadonlyArray<LockfileDependent>;
}

export function collectUnneededOverrides(
  input: UnneededOverridesInput,
): Array<DependencyGateFinding> {
  return Object.entries(input.overrides).flatMap(([entry, pin]) => {
    const target = parseOverrideKey(entry);

    const ranges = input.dependents
      .filter((dependent) => isOverrideDependent(target, dependent))
      .map((dependent) => dependent.range);

    if (ranges.length === 0) {
      return [{ entry, problem: 'no package in bun.lock depends on the overridden package' }];
    }

    const isPinOutsideARange = ranges.some((range) => !Bun.semver.satisfies(pin, range));
    const isPinTheCatalogVersion = input.catalog[target.name] === pin;

    if (isPinOutsideARange || isPinTheCatalogVersion) {
      return [];
    }

    return [
      {
        entry,
        problem: `every range in bun.lock already admits ${pin}, so the override changes nothing`,
      },
    ];
  });
}

interface OverrideTarget {
  readonly name: string;
  readonly parent: string | undefined;
}

// bun scopes an override to one dependent with `parent>name`, where the parent may carry an
// exact version, such as `sdk-logs@0.208.0>@opentelemetry/core`
function parseOverrideKey(entry: string): OverrideTarget {
  const separatorIndex = entry.lastIndexOf('>');

  if (separatorIndex === -1) {
    return { name: entry, parent: undefined };
  }

  return { name: entry.slice(separatorIndex + 1), parent: entry.slice(0, separatorIndex) };
}

function isOverrideDependent(target: OverrideTarget, dependent: LockfileDependent): boolean {
  if (dependent.name !== target.name) {
    return false;
  }

  if (target.parent === undefined) {
    return true;
  }

  return (
    dependent.dependent === target.parent || dependent.dependent.startsWith(`${target.parent}@`)
  );
}
