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

    // a scoped override holds only its parent's copy, so it can't keep every copy on the catalog
    // version the way a top-level one does
    const isPinTheCatalogVersion =
      target.parent === undefined && input.catalog[target.name] === pin;

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

interface PackageSpec {
  readonly name: string;
  readonly version: string | undefined;
}

interface OverrideTarget {
  readonly name: string;
  readonly parent: PackageSpec | undefined;
}

// bun scopes an override to one dependent with `parent>name`, where the parent may carry a version,
// such as `@opentelemetry/sdk-logs@0.208.0>@opentelemetry/core`; in a longer chain the package
// nearest the overridden one is its dependent
function parseOverrideKey(entry: string): OverrideTarget {
  const segments = entry.split('>');
  const name = segments.at(-1) ?? entry;
  const parent = segments.at(-2);

  return { name, parent: parent === undefined ? undefined : parsePackageSpec(parent) };
}

function parsePackageSpec(spec: string): PackageSpec {
  // index 0 is a scope's own `@`, never a version separator
  const separatorIndex = spec.lastIndexOf('@');

  if (separatorIndex <= 0) {
    return { name: spec, version: undefined };
  }

  return { name: spec.slice(0, separatorIndex), version: spec.slice(separatorIndex + 1) };
}

function isOverrideDependent(target: OverrideTarget, dependent: LockfileDependent): boolean {
  if (dependent.name !== target.name) {
    return false;
  }

  if (target.parent === undefined) {
    return true;
  }

  const locked = parsePackageSpec(dependent.dependent);

  if (locked.name !== target.parent.name) {
    return false;
  }

  return (
    target.parent.version === undefined ||
    (locked.version !== undefined && Bun.semver.satisfies(locked.version, target.parent.version))
  );
}
