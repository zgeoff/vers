export interface RNG {
  getInt: (min: number, max: number) => number;
  getSeries: (min: number, max: number, count: number) => Array<number>;
  getState: () => string;
}
