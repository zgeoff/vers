interface ContentCoverageInput {
  readonly currentContentVersion: string | undefined;
  readonly maxContentVersion: string | undefined;
}

// content versions are numeric strings, the same rule the activity start admission applies
export function findContentCoverageGap(input: Readonly<ContentCoverageInput>): string | null {
  if (input.currentContentVersion === undefined) {
    return null;
  }

  if (input.maxContentVersion === undefined) {
    return `content version ${input.currentContentVersion} is current but no active engine is registered to replay it`;
  }

  const current = Number(input.currentContentVersion);
  const supported = Number(input.maxContentVersion);

  if (Number.isNaN(current) || Number.isNaN(supported)) {
    return `content versions are numeric strings; got current ${input.currentContentVersion} and engine max ${input.maxContentVersion}`;
  }

  if (current > supported) {
    return `content version ${input.currentContentVersion} is newer than the active engine's max content version ${input.maxContentVersion}`;
  }

  return null;
}
