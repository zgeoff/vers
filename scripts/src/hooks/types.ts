/**
 * The gate's answer for one edit: `allow` lets the tool call through, `deny` names the skills the
 * session must load first.
 */
export type SkillGateVerdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly missing: ReadonlyArray<string> };

/**
 * The phase a session is in. Research prefers whole reads and content search, where the intent in
 * comments and surrounding code is visible; implement prefers Serena's symbol tools, which return an
 * exact span. Plan mode is always research; the first code edit outside it flips a session to
 * implement for the rest of the session.
 */
export type RetrievalPhase = 'research' | 'implement';

/**
 * What one tool call means to the retrieval policy. `search` is a content search by the Grep tool
 * or a shell search command; `read-whole` and `read-ranged` are Read calls on a code file, split on
 * whether an offset or limit was given; `symbol-lookup` and `symbol-edit` are Serena tools; `edit`
 * is a built-in edit of a code file; everything else, including any call on a non-code file, is
 * `other`.
 */
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

/**
 * The policy's per-session counters. Each run counts consecutive calls of one shape and resets
 * when a call of another shape breaks it; `huntSearches` is how many of the current hunt run were
 * searches; `nudgedAt` is the epoch millisecond of the last nudge, 0 before the first.
 */
export interface RetrievalState {
  readonly phase: RetrievalPhase;
  readonly searchRun: number;
  readonly huntRun: number;
  readonly huntSearches: number;
  readonly lookupRun: number;
  readonly nudgedAt: number;
  readonly calls: number;
}

/**
 * The planner's answer for one call: the state to carry to the next call, and the nudge to inject
 * before this call runs, or null to stay silent.
 */
export interface RetrievalPlan {
  readonly state: RetrievalState;
  readonly nudge: string | null;
}
