import type { Localized } from '../translate';
import type { IvStat } from './engine';

/** Items a breeding plan tells you to hold, by the name the game shows (and the PokéAPI slug, for the sprite). */
export const DESTINY_KNOT = { name: { en: 'Destiny Knot', es: 'Lazo Destino' }, slug: 'destiny-knot' } as const;
export const EVERSTONE = { name: { en: 'Everstone', es: 'Piedra Eterna' }, slug: 'everstone' } as const;
export const MIRROR_HERB = { name: { en: 'Mirror Herb', es: 'Hierba Espejo' }, slug: 'mirror-herb' } as const;

/** The Power item that passes one stat's IV down, per stat. */
export const POWER_ITEMS: Record<IvStat, { name: Localized; slug: string }> = {
  hp: { name: { en: 'Power Weight', es: 'Pesa Recia' }, slug: 'power-weight' },
  attack: { name: { en: 'Power Bracer', es: 'Brazal Recio' }, slug: 'power-bracer' },
  defense: { name: { en: 'Power Belt', es: 'Cinturón Recio' }, slug: 'power-belt' },
  specialAttack: { name: { en: 'Power Lens', es: 'Lente Recia' }, slug: 'power-lens' },
  specialDefense: { name: { en: 'Power Band', es: 'Banda Recia' }, slug: 'power-band' },
  speed: { name: { en: 'Power Anklet', es: 'Franja Recia' }, slug: 'power-anklet' },
};
