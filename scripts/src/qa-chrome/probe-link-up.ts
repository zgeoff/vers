import { z } from 'zod';
import { runInNamespace } from './run-in-namespace';

const linkSchema = z.object({ flags: z.array(z.string()) });
const linksSchema = z.array(linkSchema);

export async function probeLinkUp(holderPID: number, interfaceName: string): Promise<boolean> {
  const text = await runInNamespace(holderPID, ['ip', '-j', 'link', 'show', 'dev', interfaceName]);

  const parsed: unknown = JSON.parse(text);

  return linksSchema.parse(parsed).some((link) => link.flags.includes('UP'));
}
