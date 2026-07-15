export interface IssueShape {
  readonly body: string;
  readonly labels: ReadonlyArray<string>;
  readonly milestone: string | null;
}
