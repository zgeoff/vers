import { faker } from '@faker-js/faker';
import type { RequestSpan } from '../../qa-cold/types';

export function createMockRequestSpan(overrides: Readonly<Partial<RequestSpan>> = {}): RequestSpan {
  const path = `/${faker.lorem.slug(2)}`;

  return {
    name: `${faker.internet.httpMethod()} ${path}`,
    path,
    service: `service-${faker.lorem.word()}`,
    statusCode: faker.internet.httpStatusCode({ types: ['success'] }),
    traceID: faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' }),
    ...overrides,
  };
}
