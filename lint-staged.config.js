/* eslint-disable perfectionist/sort-objects */
export default {
  'projects/{app-web,service-api}/**/*.{ts,tsx}': () => [
    `yarn codegen:graphql`,
    'git add .',
  ],
  'projects/**/*.{ts,tsx}': [
    'yarn codegen:styles',
    (files) => `yarn nx affected --target=typecheck --files=${files.join(',')}`,
    'yarn test run --changed',
  ],
  'projects/**/*.{js,ts,jsx,tsx,json}': (files) => [
    `yarn format --files ${files.join(',')}`,
    `yarn lint --files ${files.join(',')}`,
    'git add .',
  ],
  'projects/lib-postgres-schema/**/*.ts': () => [
    'yarn pg:migrations-generate',
    'git add .',
  ],
  '**/*.graphql': () => ['yarn format', 'git add .'],
};
/* eslint-enable perfectionist/sort-objects */
