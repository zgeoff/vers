/* eslint-disable perfectionist/sort-objects */
export default {
  'projects/{app-web,service-api}/**/*.{ts,tsx}': () => [
    `bun run codegen:graphql`,
    'git add .',
  ],
  'projects/**/*.{ts,tsx}': () => [
    'bun run codegen:styles',
    'bun run typecheck',
    'bun run test',
  ],
  'projects/**/*.{js,ts,jsx,tsx,json}': (files) => [
    `bun run format --files ${files.join(',')}`,
    `bun run lint --files ${files.join(',')}`,
    'git add .',
  ],
  'projects/lib-postgres-schema/**/*.ts': () => [
    'bun run pg:migrations-generate',
    'git add .',
  ],
  '**/*.graphql': () => ['bun run format', 'git add .'],
};
/* eslint-enable perfectionist/sort-objects */
