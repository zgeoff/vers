export interface ContentSource {
  readonly path: string;
  readonly text: string;
}

export interface ContentDigestDrift {
  readonly bundledContentVersion: string;
  readonly digest: string;
  readonly recordedDigest: string | undefined;
}
