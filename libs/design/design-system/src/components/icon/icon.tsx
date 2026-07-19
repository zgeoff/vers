import {
  GiAchievement,
  GiAnvil,
  GiCharacter,
  GiCog,
  GiConvergenceTarget,
  GiCrossedSwords,
  GiCutDiamond,
  GiGriffinShield,
  GiOpenBook,
  GiPolarStar,
  GiRosaShield,
  GiTrade,
} from 'react-icons/gi';
import { TbAlertSmall, TbCheck, TbCopy, TbMenu2, TbX } from 'react-icons/tb';

export const Icon = {
  Alert: TbAlertSmall,
  Checkmark: TbCheck,
  Clipboard: TbCopy,
  Close: TbX,
  Menu: TbMenu2,

  // feature specific
  Account: GiCog,
  Arena: GiCrossedSwords,
  Avatar: GiCharacter,
  Encounter: GiConvergenceTarget,
  Explore: GiPolarStar,
  Forge: GiAnvil,
  Guild: GiGriffinShield,
  Leaderboard: GiAchievement,
  Market: GiTrade,
  Respite: GiRosaShield,
  Stash: GiCutDiamond,
  Wiki: GiOpenBook,
};
