import type { ContainerExit } from './types';

export function formatContainerExit(exit: Readonly<ContainerExit>): string {
  return `exited with code ${exit.exitCode}${exit.oomKilled ? ' after the kernel killed it for memory' : ''}`;
}
