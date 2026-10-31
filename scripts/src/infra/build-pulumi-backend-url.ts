interface PulumiBackend {
  readonly bucket: string;
  readonly cloudflareAccountID: string;
}

// Pulumi's S3 backend reaches R2 through its S3 API, which needs path-style addressing and the
// `auto` region.
export function buildPulumiBackendURL(backend: Readonly<PulumiBackend>): string {
  return `s3://${backend.bucket}?endpoint=${backend.cloudflareAccountID}.r2.cloudflarestorage.com&region=auto&s3ForcePathStyle=true`;
}
