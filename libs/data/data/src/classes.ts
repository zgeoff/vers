import { Attribute, Class } from './types';

interface ClassData {
  description: Array<string>;
  images: {
    full: string;
    icon: string;
    unitFrame: string;
  };
  name: string;
  primaryAttributes: Array<Attribute>;
}

type ClassesData = Record<(typeof Class)[keyof typeof Class], ClassData>;

export const classes: ClassesData = {
  [Class.Brute]: {
    description: [
      'Only the strong remain.',
      'You survived, bearing the scars of resilience, your body a testament to defiance.',
      'Stand firm where others falter.',
    ],
    images: {
      full: '/assets/images/class-full-brute.png',
      icon: '/assets/images/class-icon-brute.png',
      unitFrame: '/assets/images/class-unit-frame-brute.png',
    },
    name: 'Brute',
    primaryAttributes: [Attribute.Strength],
  },
  [Class.Scholar]: {
    description: [
      'Vision shapes reality.',
      'Wisdom is your blade that cuts through ignorance, your insight illuminates the path.',
      'Wield knowledge and reveal truth.',
    ],
    images: {
      full: '/assets/images/class-full-scholar.png?v=1',
      icon: '/assets/images/class-icon-scholar.png',
      unitFrame: '/assets/images/class-unit-frame-scholar.png',
    },
    name: 'Scholar',
    primaryAttributes: [Attribute.Intelligence],
  },
  [Class.Scoundrel]: {
    description: [
      'The adaptable will overcome.',
      'Your reflexes prove sharper than reason, precision shaping victory from chaos.',
      'Let instinct guide your actions.',
    ],
    images: {
      full: '/assets/images/class-full-scoundrel.png',
      icon: '/assets/images/class-icon-scoundrel.png',
      unitFrame: '/assets/images/class-unit-frame-scoundrel.png',
    },
    name: 'Scoundrel',
    primaryAttributes: [Attribute.Dexterity],
  },
};
