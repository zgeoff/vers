export interface IssueShape {
  readonly body: string;
  readonly labels: ReadonlyArray<string>;
  readonly milestone: string | null;
}

/**
 * A stub whose text is the named `##` section of the issue type's template, extracted from the
 * template at render time so it never drifts from the template itself.
 */
interface SectionStub {
  readonly kind: 'section';
  readonly title: string;
  readonly templatePath: string;
}

/**
 * A stub whose text is fixed rather than drawn from a template section — the upkeep trigger line,
 * which lives in a fenced block, not under a heading.
 */
interface LiteralStub {
  readonly kind: 'literal';
  readonly markdown: string;
}

/**
 * A single hygiene violation, phrased so the issue author can act on it: `task` is the imperative
 * fix, `rule` names the AGENTS.md requirement it enforces, and `stub` — present when the fix is
 * pasted body content — describes the paste-ready block to offer.
 */
export interface Finding {
  readonly task: string;
  readonly rule: string;
  readonly stub?: SectionStub | LiteralStub;
}

/**
 * A finding whose stub has been resolved to paste-ready markdown, ready for the comment renderer.
 */
export interface ResolvedFinding {
  readonly task: string;
  readonly rule: string;
  readonly stub?: string;
}
