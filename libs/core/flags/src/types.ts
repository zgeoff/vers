import type { FLAGS } from './flags';

export type FlagKey = keyof typeof FLAGS;

export interface FlagDefinition {
  readonly defaultValue: boolean;
  readonly description: string;
}
