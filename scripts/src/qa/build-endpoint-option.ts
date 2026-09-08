import { Option } from 'commander';
import { parseEndpoint } from './parse-endpoint';

const DEFAULT_ENDPOINT = '127.0.0.1:9222';

export function buildEndpointOption(): Option {
  return new Option('--endpoint <host:port>', 'DevTools endpoint')
    .env('QA_CDP_ENDPOINT')
    .argParser(parseEndpoint)
    .default(DEFAULT_ENDPOINT);
}
