export type SkillGateVerdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly missing: ReadonlyArray<string> };

export type RetrievalPhase = 'research' | 'implement';

export type RetrievalKind =
  | 'search'
  | 'read-whole'
  | 'read-ranged'
  | 'symbol-lookup'
  | 'symbol-edit'
  | 'edit'
  | 'other';

export interface RetrievalCall {
  readonly toolName: string;
  readonly toolInput: Readonly<Record<string, unknown>>;
  readonly permissionMode: string;
}

export interface RetrievalState {
  readonly phase: RetrievalPhase;
  readonly searchRun: number;
  readonly huntRun: number;
  readonly huntSearches: number;
  readonly lookupRun: number;
  readonly nudgedAt: number;
  readonly calls: number;
}

export interface RetrievalPlan {
  readonly state: RetrievalState;
  readonly nudge: string | null;
}
