import type { HttpHandler } from 'msw';
import { HttpResponse, http } from 'msw';
import { ProductEventRowSchema, productEventCollection } from '../db/product-event-collection';

/**
 * Builds the MSW handler backing the Tinybird Events API at the given origin. Every NDJSON row a
 * POST carries lands in the product-event collection for tests to assert on, tagged with the
 * `name` query parameter's target data source; the response mirrors the Events API's accepted
 * shape.
 */
export function buildTinybirdMockHandlers(baseUrl: string): Array<HttpHandler> {
  return [
    http.post(`${baseUrl}/v0/events`, async (info) => {
      const url = new URL(info.request.url);

      const datasource = url.searchParams.get('name') ?? '';

      const body = await info.request.text();

      const lines = body.split('\n').filter((line) => line.length > 0);

      for (const line of lines) {
        const raw: unknown = JSON.parse(line);
        const row = ProductEventRowSchema.parse(raw);

        await productEventCollection.create({ ...row, datasource });
      }

      return HttpResponse.json(
        { quarantined_rows: 0, successful_rows: lines.length },
        { status: 202 },
      );
    }),
  ];
}
