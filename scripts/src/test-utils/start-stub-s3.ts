import { onTestFinished } from 'bun:test';

interface StubS3Options {
  // a corrupted body stands in for an upload that landed damaged, so a read-back sees other bytes
  readonly corruptStoredBodies?: boolean;
  readonly pageSize?: number;
}

interface StubS3 {
  readonly bucket: string;
  readonly endpoint: string;
}

interface StoredObject {
  readonly body: Uint8Array;
  readonly lastModified: Date;
}

const BUCKET = 'stub-bucket';
const DEFAULT_PAGE_SIZE = 1000;

export function startStubS3(options: Readonly<StubS3Options> = {}): StubS3 {
  const objects = new Map<string, StoredObject>();

  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  const handleRequest = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    const [bucket, ...keyParts] = url.pathname.slice(1).split('/');

    if (bucket !== BUCKET) {
      return buildErrorResponse(404, 'NoSuchBucket');
    }

    const key = decodeURIComponent(keyParts.join('/'));

    if (key === '' && request.method === 'GET') {
      return buildListResponse(objects, url.searchParams, pageSize);
    }

    if (request.method === 'PUT') {
      const uploaded = await request.arrayBuffer();

      const body = new Uint8Array(uploaded);

      const storedBody = options.corruptStoredBodies === true ? body.slice(1) : body;

      objects.set(key, { body: storedBody, lastModified: new Date() });

      return new Response(null, { headers: { etag: `"${hashBody(body)}"` }, status: 200 });
    }

    const stored = objects.get(key);

    if (request.method === 'DELETE') {
      objects.delete(key);

      return new Response(null, { status: 204 });
    }

    if (stored === undefined) {
      return buildErrorResponse(404, 'NoSuchKey');
    }

    const headers = {
      'content-length': String(stored.body.byteLength),
      etag: `"${hashBody(stored.body)}"`,
      'last-modified': stored.lastModified.toUTCString(),
    };

    const responseBody = request.method === 'HEAD' ? null : stored.body;

    return new Response(responseBody, { headers });
  };

  const server = Bun.serve({ fetch: handleRequest, port: 0 });

  onTestFinished(async () => {
    await server.stop(true);
  });

  return { bucket: BUCKET, endpoint: server.url.origin };
}

function buildErrorResponse(status: number, code: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`, {
    headers: { 'content-type': 'application/xml' },
    status,
  });
}

function buildListResponse(
  objects: ReadonlyMap<string, StoredObject>,
  params: URLSearchParams,
  pageSize: number,
): Response {
  const prefix = params.get('prefix') ?? '';
  const after = params.get('continuation-token') ?? '';
  const maxKeys = Math.min(Number(params.get('max-keys') ?? pageSize), pageSize);

  const matching = [...objects.entries()]
    .filter(([key]) => key.startsWith(prefix) && key > after)
    .toSorted(([left], [right]) => (left < right ? -1 : 1));

  const page = matching.slice(0, maxKeys);
  const isTruncated = matching.length > page.length;

  const contents = page.map(
    ([key, stored]) =>
      `<Contents><Key>${key}</Key><LastModified>${stored.lastModified.toISOString()}</LastModified><ETag>&quot;${hashBody(stored.body)}&quot;</ETag><Size>${stored.body.byteLength}</Size><StorageClass>STANDARD</StorageClass></Contents>`,
  );

  const next = isTruncated
    ? `<NextContinuationToken>${page.at(-1)?.[0]}</NextContinuationToken>`
    : '';

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${BUCKET}</Name><Prefix>${prefix}</Prefix><KeyCount>${page.length}</KeyCount><MaxKeys>${maxKeys}</MaxKeys><IsTruncated>${isTruncated}</IsTruncated>${contents.join('')}${next}</ListBucketResult>`,
    { headers: { 'content-type': 'application/xml' } },
  );
}

function hashBody(body: Uint8Array): string {
  return new Bun.CryptoHasher('md5').update(body).digest('hex');
}
