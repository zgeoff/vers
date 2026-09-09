import type { SharedSecretHolder } from './types';

export function checkSharedSecrets(
  holders: ReadonlyArray<SharedSecretHolder>,
): ReadonlyArray<string> {
  const names = [...new Set(holders.flatMap((holder) => holder.sharedSecrets))].toSorted();

  return names.flatMap((name) =>
    checkSharedSecret(
      name,
      holders.filter((holder) => holder.sharedSecrets.includes(name)),
    ),
  );
}

const DIGEST_PREFIX_LENGTH = 12;

function checkSharedSecret(
  name: string,
  holders: ReadonlyArray<SharedSecretHolder>,
): ReadonlyArray<string> {
  const findings: Array<string> = [];

  const unset = holders
    .filter((holder) => findDigest(holder, name) === null)
    .map((holder) => holder.app)
    .toSorted();

  if (unset.length > 0) {
    findings.push(`shared secret ${name} is unset on ${unset.join(', ')}`);
  }

  const appsByDigest = new Map<string, Array<string>>();

  for (const holder of holders) {
    const digest = findDigest(holder, name);

    if (digest === null) {
      continue;
    }

    appsByDigest.set(digest, [...(appsByDigest.get(digest) ?? []), holder.app]);
  }

  if (appsByDigest.size <= 1) {
    return findings;
  }

  // default string sort — code-unit order keeps the finding text identical across locales
  const groups = [...appsByDigest.keys()].toSorted().map((digest) => {
    const apps = (appsByDigest.get(digest) ?? []).toSorted();

    return `${digest.slice(0, DIGEST_PREFIX_LENGTH)} on ${apps.join(', ')}`;
  });

  findings.push(
    `shared secret ${name} holds ${appsByDigest.size} values across the apps that declare it: ${groups.join('; ')}`,
  );

  return findings;
}

function findDigest(holder: SharedSecretHolder, name: string): string | null {
  return holder.secrets.find((secret) => secret.name === name)?.digest ?? null;
}
