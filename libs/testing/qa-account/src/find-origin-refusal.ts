import type { HostTarget } from './types';

export function findOriginRefusal(target: HostTarget, allowRemote: boolean): string | null {
  if (target.isLoopback) {
    return null;
  }

  if (!allowRemote) {
    return `${target.host} is not a loopback host; pass --yes to seed through it`;
  }

  if (target.protocol !== 'https:') {
    return `${target.host} is not a loopback host, so the QA token goes to it only over https`;
  }

  return null;
}
