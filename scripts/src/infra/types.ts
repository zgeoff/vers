export interface InfraStackResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

// a GitHub Actions step outcome; the drift check before the apply skips on a manual dispatch
export type DriftOutcome = 'success' | 'failure' | 'skipped';

export type InfraOutcome = 'apply' | 'held';

export interface PulumiPlanStep {
  readonly op: string;
  readonly urn: string;
}

interface PulumiDiagnostic {
  readonly severity: string;
  readonly message: string;
}

export interface PulumiPlan {
  readonly steps: ReadonlyArray<PulumiPlanStep>;
  readonly diagnostics: ReadonlyArray<PulumiDiagnostic>;
  readonly changeSummary: Readonly<Record<string, number>>;
}
