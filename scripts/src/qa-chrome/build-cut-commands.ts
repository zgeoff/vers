import type { NetworkCut } from './types';

export function buildCutCommands(cut: NetworkCut): Array<Array<string>> {
  const hasIPv6 = cut.routes.some(
    (route) => route.family === 'inet6' && route.dev === cut.interfaceName,
  );

  // the kernel deletes an interface's global IPv6 addresses when the link goes down, unless the
  // interface keeps them; IPv4 addresses stay either way
  const keepIPv6Addresses = hasIPv6
    ? [['sysctl', '-w', `net.ipv6.conf.${cut.interfaceName}.keep_addr_on_down=1`]]
    : [];

  return [...keepIPv6Addresses, ['ip', 'link', 'set', 'dev', cut.interfaceName, 'down']];
}
