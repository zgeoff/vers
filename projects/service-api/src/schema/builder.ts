import SchemaBuilder from '@pothos/core';
import DirectivePlugin from '@pothos/plugin-directives';
import { DateResolver, DateTimeResolver } from 'graphql-scalars';
import type { Context } from '../types';

interface SchemaConfig {
  Context: Context;
  DefaultFieldNullability: false;
  Directives: {
    rateLimit: {
      args: {
        duration: number;
        limit: number;
      };
      locations: 'FIELD_DEFINITION' | 'OBJECT';
    };
  };
  Scalars: {
    Date: {
      Input: Date;
      Output: Date;
    };
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
}

export const builder = new SchemaBuilder<SchemaConfig>({
  defaultFieldNullability: false,
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
  plugins: [DirectivePlugin],
});

builder.queryType({});

builder.mutationType({});

builder.addScalarType('Date', DateResolver);
builder.addScalarType('DateTime', DateTimeResolver);
