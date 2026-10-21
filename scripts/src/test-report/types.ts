export interface JUnitReport {
  readonly path: string;
  readonly xml: string;
}

export interface TestTiming {
  readonly file: string;
  readonly name: string;
  readonly seconds: number;
}
