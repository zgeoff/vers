/**
 * One repository path a markdown document names, with the line that names it.
 */
export interface DocPathReference {
  readonly line: number;
  readonly path: string;
}
