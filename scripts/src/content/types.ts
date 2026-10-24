export interface ContentSource {
  readonly path: string;
  readonly text: string;
}

export type ContentDigestFinding =
  | {
      readonly kind: 'sources-drifted';
      readonly bundledContentVersion: string;
      readonly digest: string;
      readonly recordedDigest: string | undefined;
    }
  | {
      readonly kind: 'recorded-digest-rewritten';
      readonly baseDigest: string;
      readonly contentVersion: string;
      readonly recordedDigest: string | undefined;
    };
