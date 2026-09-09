interface ContentCoverageInput {
  readonly contentVersion: string | undefined;
  readonly maxContentVersion: string | undefined;
}

// the same numeric-string rule the content document schema enforces, applied here so a malformed
// registry value reads as a gap rather than coercing to a number that passes
const NUMERIC_VERSION = /^\d+$/;

export function findContentCoverageGap(input: Readonly<ContentCoverageInput>): string | null {
  if (input.contentVersion === undefined) {
    return null;
  }

  if (input.maxContentVersion === undefined) {
    return `content version ${input.contentVersion} has no active engine registered to replay it`;
  }

  if (
    !NUMERIC_VERSION.test(input.contentVersion) ||
    !NUMERIC_VERSION.test(input.maxContentVersion)
  ) {
    return `content versions are numeric strings; got content ${input.contentVersion} and engine max ${input.maxContentVersion}`;
  }

  if (Number(input.contentVersion) > Number(input.maxContentVersion)) {
    return `content version ${input.contentVersion} is newer than the active engine's max content version ${input.maxContentVersion}`;
  }

  return null;
}
