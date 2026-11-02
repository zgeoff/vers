import { $ } from 'bun';

export async function readMainTip(repoPath: string): Promise<string> {
  const output = await $`git ls-remote origin refs/heads/main`.cwd(repoPath).quiet().text();

  const [tip = ''] = output.split('\t', 1);

  if (tip === '') {
    throw new Error(`origin of ${repoPath} has no main branch`);
  }

  return tip;
}
