import type { FLAGS } from './flags';

/**
 * A registered flag's key, drawn from {@link FLAGS}.
 */
export type FlagKey = keyof typeof FLAGS;

/**
 * A flag's static declaration: its safe fallback and what it gates.
 */
export interface FlagDefinition {
  readonly defaultValue: boolean;
  readonly description: string;
}
