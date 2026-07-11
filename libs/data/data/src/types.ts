export const Class = {
  Brute: 'brute',
  Scholar: 'scholar',
  Scoundrel: 'scoundrel',
} as const;

export type ClassID = (typeof Class)[keyof typeof Class];

export enum Attribute {
  Dexterity = 'Dexterity',
  Intelligence = 'Intelligence',
  Strength = 'Strength',
}
