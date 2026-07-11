import {
  GiAchievement,
  GiAnvil,
  GiCharacter,
  GiChest,
  GiCog,
  GiCrossedSwords,
  GiGriffinShield,
  GiHangingSign,
  GiOpenBook,
  GiPolarStar,
  GiSpikedDragonHead,
  GiStarSwirl,
} from 'react-icons/gi';
import { TbAlertSmall, TbCheck, TbCopy, TbMenu2 } from 'react-icons/tb';

export const Icon = {
  Alert: TbAlertSmall,
  Checkmark: TbCheck,
  Clipboard: TbCopy,
  Menu: TbMenu2,

  // feature specific
  Account: GiCog,
  Arena: GiCrossedSwords,
  Avatar: GiCharacter,
  Encounter: GiSpikedDragonHead,
  Explore: GiStarSwirl,
  Forge: GiAnvil,
  Guild: GiGriffinShield,
  Leaderboard: GiAchievement,
  Market: GiHangingSign,
  Respite: GiPolarStar,
  Stash: GiChest,
  Wiki: GiOpenBook,
};
