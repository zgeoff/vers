import invariant from 'tiny-invariant';
import { match } from 'ts-pattern';
import { classifyRefresh } from './classify-refresh';
import type { LostRotationDecision, RefreshSessionState } from './types';

export function classifyLostRotation(
  row: RefreshSessionState | undefined,
  token: string,
  now: Date,
): LostRotationDecision {
  return match(classifyRefresh(row, token, now))
    .returnType<LostRotationDecision>()
    .with({ kind: 'missing' }, { kind: 'mismatch' }, () => ({ kind: 'reuse' }))
    .with({ kind: 'renew' }, { kind: 'rotate' }, () => {
      invariant(false, 'a lost rotation leaves the presented token no longer current');
    })
    .with({ kind: 'expired' }, { kind: 'grace' }, { kind: 'reuse' }, (decision) => decision)
    .exhaustive();
}
