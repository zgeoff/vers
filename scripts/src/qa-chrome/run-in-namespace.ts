export async function runInNamespace(
  holderPID: number,
  command: ReadonlyArray<string>,
): Promise<string> {
  // without --preserve-credentials, nsenter calls setgroups in the user namespace, which the kernel
  // refuses an unprivileged user
  const child = Bun.spawn(
    ['nsenter', '-t', String(holderPID), '--preserve-credentials', '-U', '-n', ...command],
    { stderr: 'pipe', stdout: 'pipe' },
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`${command.join(' ')} failed in the namespace: ${stderr.trim()}`);
  }

  return stdout;
}
