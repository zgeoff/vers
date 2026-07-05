import { Class } from '@vers/data';
import { AvatarClass as GQLEnumClass } from '../../gql/graphql';

export function resolveClassFromGQLEnum(type: GQLEnumClass): (typeof Class)[keyof typeof Class] {
  return CLASS_ENUM_MAP[type];
}

type ClassEnumMap = Record<GQLEnumClass, (typeof Class)[keyof typeof Class]>;

const CLASS_ENUM_MAP: ClassEnumMap = {
  [GQLEnumClass.Brute]: Class.Brute,
  [GQLEnumClass.Scholar]: Class.Scholar,
  [GQLEnumClass.Scoundrel]: Class.Scoundrel,
} as const;
