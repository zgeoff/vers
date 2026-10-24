import type { DependencyGateFinding, LockfileDependent } from './types';

interface UnneededOverridesInput {
  readonly overrides: Readonly<Record<string, string>>;
  readonly catalog: Readonly<Record<string, string>>;
  readonly dependents: ReadonlyArray<LockfileDependent>;
}

export function collectUnneededOverrides(
  input: UnneededOverridesInput,
): Array<DependencyGateFinding> {
  return Object.entries(input.overrides).flatMap(([name, pin]) => {
    const ranges = input.dependents
      .filter((dependent) => dependent.name === name)
      .map((dependent) => dependent.range);

    if (ranges.length === 0) {
      return [{ entry: name, problem: 'no package in bun.lock depends on the overridden package' }];
    }

    const isPinOutsideARange = ranges.some((range) => !Bun.semver.satisfies(pin, range));
    const isPinTheCatalogVersion = input.catalog[name] === pin;

    if (isPinOutsideARange || isPinTheCatalogVersion) {
      return [];
    }

    return [
      {
        entry: name,
        problem: `every range in bun.lock already admits ${pin}, so the override changes nothing`,
      },
    ];
  });
}
