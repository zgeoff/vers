import { Class } from '@vers/data';
import { AvatarClass as GQLEnumClass } from '~/gql/graphql';

export function resolveGQLEnumFromClass(type: (typeof Class)[keyof typeof Class]): GQLEnumClass {
  return GQL_CLASS_MAP[type];
}

type GQLClassMap = Record<(typeof Class)[keyof typeof Class], GQLEnumClass>;

const GQL_CLASS_MAP: GQLClassMap = {
  [Class.Brute]: GQLEnumClass.Brute,
  [Class.Scholar]: GQLEnumClass.Scholar,
  [Class.Scoundrel]: GQLEnumClass.Scoundrel,
} as const;
