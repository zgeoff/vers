import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  config: {
    scalars: {
      Date: {
        input: 'Date',
        output: 'string',
      },
      DateTime: {
        input: 'Date',
        output: 'string',
      },
    },
    useTypeImports: true,
  },
  documents: ['projects/app-web/app/data/**/*.ts'],
  generates: {
    './projects/app-web/app/gql/': {
      plugins: [],
      preset: 'client',
    },
    'schema.graphql': {
      plugins: ['schema-ast'],
    },
  },
  require: ['tsx/cjs'],
  schema: './projects/service-api/src/schema/**/*.ts',
};

export default config;
