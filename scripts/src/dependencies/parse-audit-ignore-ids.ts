import invariant from 'tiny-invariant';

export function parseAuditIgnoreIDs(auditScript: string): Array<string> {
  return [...auditScript.matchAll(/--ignore[= ](?<advisoryID>\S+)/gu)].map((match) => {
    const advisoryID = match.groups?.['advisoryID'];

    invariant(advisoryID !== undefined, 'the ignore pattern names the advisory');

    return advisoryID;
  });
}
