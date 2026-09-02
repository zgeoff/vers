export interface IssueShape {
  readonly body: string;
  readonly labels: ReadonlyArray<string>;
  readonly milestone: string | null;
}

interface SectionStub {
  readonly kind: 'section';
  readonly title: string;
  readonly templatePath: string;
}

interface LiteralStub {
  readonly kind: 'literal';
  readonly markdown: string;
}

export interface Finding {
  readonly task: string;
  readonly rule: string;
  readonly stub?: SectionStub | LiteralStub;
}

export interface ResolvedFinding {
  readonly task: string;
  readonly rule: string;
  readonly stub?: string;
}
