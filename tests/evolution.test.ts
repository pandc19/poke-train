import { describe, expect, it } from 'vitest';
import {
  describeEvolution,
  pickEvolutionDetails,
  type EvolutionDetail,
  type EvolutionNames,
} from '@/lib/pokeapi/evolution';

// Release order of the game versions used below (PokéAPI's version-group order, in the same sequence).
const ORDER: Record<string, number> = {
  'red-blue': 1,
  'gold-silver': 3,
  'diamond-pearl': 8,
  'x-y': 15,
  'sun-moon': 17,
  'sword-shield': 20,
  'the-isle-of-armor': 21,
  'legends-arceus': 24,
  'scarlet-violet': 25,
  'the-teal-mask': 26,
  'the-indigo-disk': 27,
  'legends-za': 30,
};
const orderOf = (vg: string) => ORDER[vg] ?? Infinity;
const VIOLET = ORDER['the-indigo-disk'];
const VIOLET_GROUPS = ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk'];

const ref = (name: string) => ({ name });
const step = (vg: string, trigger: string, rest: Partial<EvolutionDetail> = {}): EvolutionDetail => ({
  version_group: ref(vg),
  trigger: ref(trigger),
  ...rest,
});

const NAMES: EvolutionNames = {
  item: new Map([
    ['leaf-stone', { en: 'Leaf Stone', es: 'Piedra Hoja' }],
    ['galarica-cuff', { en: 'Galarica Cuff', es: 'Brazal Galanuez' }],
    ['kings-rock', { en: "King's Rock", es: 'Roca del Rey' }],
  ]),
  move: new Map([
    ['barb-barrage', { en: 'Barb Barrage', es: 'Mil Púas Tóxicas' }],
    ['psyshield-bash', { en: 'Psyshield Bash', es: 'Asalto Barrera' }],
  ]),
  species: new Map(),
};

const how = (details: EvolutionDetail[], region = '') =>
  describeEvolution(pickEvolutionDetails(details, orderOf, VIOLET, region), NAMES, VIOLET_GROUPS);

describe('how a Pokémon evolves in the game being played', () => {
  it('uses the newest method that is not newer than the game', () => {
    const leafeon = [
      step('diamond-pearl', 'level-up', { location: ref('eterna-forest'), required_pokemon_form: ref('eevee') }),
      step('sun-moon', 'level-up', { location: ref('lush-jungle'), required_pokemon_form: ref('eevee') }),
      step('sword-shield', 'use-item', { item: ref('leaf-stone'), required_pokemon_form: ref('eevee') }),
    ];
    expect(how(leafeon)).toEqual({ en: 'Leaf Stone', es: 'Piedra Hoja' });
  });

  it('leaves out methods from games released after it', () => {
    const overqwil = [
      step('scarlet-violet', 'level-up', { known_move: ref('barb-barrage') }),
      step('legends-za', 'use-move', { used_move: ref('barb-barrage'), min_move_count: 20 }),
    ];
    expect(how(overqwil)).toEqual({
      en: 'Level up, knowing Barb Barrage',
      es: 'Subir de nivel, sabiendo Mil Púas Tóxicas',
    });
  });

  it('shows a regional form’s method only for that form', () => {
    const slowbro = [
      step('red-blue', 'level-up', { min_level: 37 }),
      step('the-isle-of-armor', 'use-item', { item: ref('galarica-cuff'), evolved_pokemon_form: ref('slowbro-galar') }),
    ];
    expect(how(slowbro)?.en).toBe('Lv. 37');
    expect(how(slowbro, 'galar')).toEqual({ en: 'Galarica Cuff', es: 'Brazal Galanuez' });
  });

  it('keeps a step that only exists for a regional form', () => {
    const clodsire = [step('scarlet-violet', 'level-up', { min_level: 20, required_pokemon_form: ref('wooper-paldea') })];
    expect(how(clodsire)).toEqual({ en: 'Lv. 20', es: 'Nv. 20' });
  });

  it('merges forms that evolve the same way, and drops gender when both genders can', () => {
    const toxtricity = [
      step('sword-shield', 'level-up', { min_level: 30, evolved_pokemon_form: ref('toxtricity-amped') }),
      step('sword-shield', 'level-up', { min_level: 30, evolved_pokemon_form: ref('toxtricity-low-key') }),
    ];
    expect(how(toxtricity)?.en).toBe('Lv. 30');

    const basculegion = [
      step('legends-arceus', 'recoil-damage', { min_damage_taken: 294, gender: 2, evolved_pokemon_form: ref('basculegion-male') }),
      step('legends-arceus', 'recoil-damage', { min_damage_taken: 294, gender: 1, evolved_pokemon_form: ref('basculegion-female') }),
    ];
    expect(how(basculegion)?.en).toBe('Lose 294 HP from recoil');

    const froslass = [step('diamond-pearl', 'use-item', { item: ref('dawn-stone'), gender: 1 })];
    expect(how(froslass)?.en).toBe('Dawn Stone, ♀');
  });

  it('names Legends: Arceus styles only in that game', () => {
    const wyrdeer = [step('legends-arceus', 'agile-style-move', { used_move: ref('psyshield-bash'), min_move_count: 20 })];
    expect(how(wyrdeer)).toEqual({ en: 'Use Psyshield Bash 20 times', es: 'Usar Asalto Barrera 20 veces' });
    const inArceus = describeEvolution(wyrdeer, NAMES, ['legends-arceus']);
    expect(inArceus?.en).toBe('Use Psyshield Bash 20 times in agile style');
  });

  it('describes trades and friendship', () => {
    expect(how([step('red-blue', 'trade')])).toEqual({ en: 'Trade', es: 'Intercambio' });
    expect(how([step('gold-silver', 'trade', { held_item: ref('kings-rock') })])?.es).toBe('Intercambio llevando Roca del Rey');
    expect(how([step('gold-silver', 'level-up', { min_happiness: 160, time_of_day: 'night' })])).toEqual({
      en: 'Level up, high friendship, at night',
      es: 'Subir de nivel, mucha amistad, de noche',
    });
  });

  it('has nothing to say without a method', () => {
    expect(how([])).toBeNull();
  });
});
