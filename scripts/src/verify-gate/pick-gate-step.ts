// The branch release-please opens its release pull request from.
const releaseBranch = 'release-please--branches--main';

export type GateStep =
  | { readonly kind: 'skip'; readonly reason: string }
  | { readonly kind: 'gate'; readonly baseRef: string; readonly body: string }
  | { readonly kind: 'refused'; readonly message: string };

// What the `verify / gate` step does for one pull_request event. A release pull request changes
// only versions and the changelog, and nobody runs a journey on it, so its body never holds a
// report. Only a bot opens it, so a person's branch of the same name still meets the gate.
export function pickGateStep(event: unknown): GateStep {
  const pullRequest = parsePullRequestEvent(event);

  if (pullRequest === null) {
    return {
      kind: 'refused',
      message: 'the event holds no pull request; run this on pull_request',
    };
  }

  if (pullRequest.headRef === releaseBranch && pullRequest.userType === 'Bot') {
    return { kind: 'skip', reason: 'a release pull request carries no verify report' };
  }

  return { kind: 'gate', baseRef: pullRequest.baseRef, body: pullRequest.body };
}

interface PullRequestEvent {
  readonly body: string;
  readonly baseRef: string;
  readonly headRef: string;
  readonly userType: string;
}

function parsePullRequestEvent(event: unknown): PullRequestEvent | null {
  const pullRequest = isRecord(event) ? event['pull_request'] : undefined;

  if (!isRecord(pullRequest)) {
    return null;
  }

  const body = pullRequest['body'];
  const baseRef = findRef(pullRequest['base']);
  const headRef = findRef(pullRequest['head']);
  const user = pullRequest['user'];
  const userType = isRecord(user) ? user['type'] : undefined;

  if (
    (typeof body !== 'string' && body !== null) ||
    baseRef === null ||
    headRef === null ||
    typeof userType !== 'string'
  ) {
    return null;
  }

  return { body: body ?? '', baseRef, headRef, userType };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function findRef(value: unknown): string | null {
  const ref = isRecord(value) ? value['ref'] : undefined;

  return typeof ref === 'string' && ref !== '' ? ref : null;
}
