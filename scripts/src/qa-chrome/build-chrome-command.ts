interface NamespaceLaunch {
  readonly gid: number;
  readonly pastaPath: string;
  readonly uid: number;
}

interface ChromeCommandOptions {
  readonly chromiumPath: string;
  readonly namespace: NamespaceLaunch | null;
  readonly port: number;
  readonly profileDir: string;
}

// The `sh` stays in pasta's namespaces for the life of the browser, so `nsenter` has a process to
// target: `unshare` replaces itself with Chromium in a nested user namespace.
const HOLDER_SCRIPT = '"$@" & wait $!';

export function buildChromeCommand(options: ChromeCommandOptions): Array<string> {
  const chromium = [
    options.chromiumPath,
    '--headless=new',
    `--remote-debugging-port=${options.port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${options.profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ];

  if (options.namespace === null) {
    return chromium;
  }

  return [
    options.namespace.pastaPath,
    '--config-net',

    // pasta forwards a host port to the namespace's tap address by default, where the DevTools
    // socket on 127.0.0.1 resets every connection; this flag forwards it to the namespace loopback
    '--host-lo-to-ns-lo',
    '--tcp-ports',
    `127.0.0.1/${options.port}`,
    '--udp-ports',
    'none',
    '--tcp-ns',
    'none',
    '--udp-ns',
    'none',
    '--',
    'sh',
    '-c',
    HOLDER_SCRIPT,
    'sh',
    'unshare',
    '--user',

    // pasta makes the user root in its namespace, and Chromium refuses root with its sandbox on, so
    // a nested user namespace maps the user back to their own IDs
    `--map-user=${options.namespace.uid}`,
    `--map-group=${options.namespace.gid}`,
    ...chromium,
  ];
}
