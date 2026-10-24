import type { AuditAdvisory, DependencyGateFinding } from './types';

interface UnneededAuditIgnoresInput {
  readonly ignoreIDs: ReadonlyArray<string>;
  readonly advisories: ReadonlyArray<AuditAdvisory>;
  readonly fixablePackages: ReadonlyArray<string>;
}

export function collectUnneededAuditIgnores(
  input: UnneededAuditIgnoresInput,
): Array<DependencyGateFinding> {
  return input.ignoreIDs.flatMap((ignoreID) => {
    const matches = input.advisories.filter((advisory) => advisory.advisoryIDs.includes(ignoreID));

    if (matches.length === 0) {
      return [{ entry: ignoreID, problem: 'no locked package has the ignored advisory' }];
    }

    const fixable = matches.find((advisory) =>
      input.fixablePackages.includes(advisory.packageName),
    );

    if (fixable !== undefined) {
      return [
        {
          entry: ignoreID,
          problem: `bun audit fix can move ${fixable.packageName} to a patched release in range`,
        },
      ];
    }

    return [];
  });
}
