import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { formatEvs, parseEvs } from '@/lib/import/evs';
import { applyMapping, guessMapping } from '@/lib/import/fields';
import { interpretRow, type Dictionaries } from '@/lib/import/interpret';
import { ALIASES, createMatcher, type NamedEntry } from '@/lib/import/matcher';
import { describeIssue } from '@/lib/import/issues';
import { normalizeKey, splitAlternatives, splitList, stripParens } from '@/lib/import/text';

const entry = (id: number, nameEn: string, nameEs: string): NamedEntry => ({
  id,
  slug: nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  nameEn,
  nameEs,
});

const species = [entry(74, 'Geodude', 'Geodude'), entry(76, 'Golem', 'Golem'), entry(633, 'Deino', 'Deino'), entry(635, 'Hydreigon', 'Hydreigon'), entry(906, 'Sprigatito', 'Sprigatito'), entry(908, 'Meowscarada', 'Meowscarada'), entry(884, 'Duraludon', 'Duraludon'), entry(1018, 'Archaludon', 'Archaludon')];
const moves = [entry(1, 'Rock Slide', 'Avalancha'), entry(2, 'Earthquake', 'Terremoto'), entry(3, 'Fire Punch', 'Puño Fuego'), entry(4, 'Substitute', 'Sustituto'), entry(5, 'Sucker Punch', 'Golpe Bajo'), entry(6, 'U-turn', 'Ida y Vuelta'), entry(7, 'Flower Trick', 'Truco Floral'), entry(8, 'Play Rough', 'Carantoña'), entry(9, 'Flash Cannon', 'Cañón Resplandor'), entry(10, 'Dragon Pulse', 'Pulso Dragón'), entry(11, 'Tailwind', 'Viento Afín')];
const items = [entry(1, 'Muscle Band', 'Cinta Fuerte'), entry(2, 'Life Orb', 'Vidasfera'), entry(3, 'Choice Band', 'Cinta Elección'), entry(4, 'Focus Sash', 'Banda Aguante')];
const abilities = [entry(1, 'Sturdy', 'Robustez'), entry(2, 'Stalwart', 'Acérrimo')];
const natures = [entry(1, 'Adamant', 'Firme'), entry(2, 'Jolly', 'Alegre'), entry(3, 'Modest', 'Modesta'), entry(4, 'Relaxed', 'Plácida')];

const dict: Dictionaries = {
  species: createMatcher(species),
  speciesById: (id) => {
    const s = species.find((x) => x.id === id);
    return s ? { ...s, exact: true } : null;
  },
  moves: createMatcher(moves, ALIASES.moves),
  items: createMatcher(items, ALIASES.items),
  abilities: createMatcher(abilities, ALIASES.abilities),
  natures: createMatcher(natures),
};

describe('text helpers', () => {
  it('normalizes accents, case and punctuation', () => {
    expect(normalizeKey(' Puño Fuego ')).toBe('punofuego');
    expect(normalizeKey('Psico-corte')).toBe('psicocorte');
  });
  it('strips explanations in parentheses', () => {
    expect(stripParens('Firme (+ataque, -ataque especial)')).toBe('Firme');
  });
  it('splits alternatives', () => {
    expect(splitAlternatives('Vidasfera o Cinta Elegida')).toEqual(['Vidasfera', 'Cinta Elegida']);
    expect(splitAlternatives('Vidasfera / Banda Focus')).toEqual(['Vidasfera', 'Banda Focus']);
    expect(splitAlternatives('Alegre (+velocidad, -ataque especial) o Firme (+ataque, -ataque especial)')).toEqual(['Alegre', 'Firme']);
  });
  it('splits move lists, tolerating a full stop typed for a comma', () => {
    expect(splitList('Avalancha, terremoto. Puño fuego, sustituto')).toEqual(['Avalancha', 'terremoto', 'Puño fuego', 'sustituto']);
  });
});

describe('matcher', () => {
  it('matches either language exactly', () => {
    expect(dict.moves('terremoto')?.slug).toBe('earthquake');
    expect(dict.moves('Earthquake')?.exact).toBe(true);
  });
  it('tolerates small typos but flags them', () => {
    expect(dict.items('Vidaesfera')).toMatchObject({ slug: 'life-orb', exact: false });
    expect(dict.species('Heydreigon')).toMatchObject({ slug: 'hydreigon', exact: false });
  });
  it('uses aliases for unofficial names', () => {
    expect(dict.items('Cinta Elegida')?.slug).toBe('choice-band');
    expect(dict.moves('Foco resplandor')?.slug).toBe('flash-cannon');
  });
  it('does not force an unknown name onto something else', () => {
    expect(dict.moves('Cuerpo Cósmico')).toBeNull();
    expect(dict.moves('xyz')).toBeNull();
  });
});

describe('EV spreads', () => {
  it('parses English and Spanish spreads', () => {
    expect(parseEvs('252 Atk / 4 SpD / 252 Spe')).toMatchObject({ attack: 252, specialDefense: 4, speed: 252 });
    expect(parseEvs('252 Ataque, 252 Velocidad, 4 PS')).toMatchObject({ attack: 252, speed: 252, hp: 4 });
  });
  it('rejects impossible spreads', () => {
    expect(parseEvs('300 Atk')).toBeNull();
    expect(parseEvs('252 Atk / 252 Spe / 252 HP')).toBeNull();
    expect(parseEvs('lots')).toBeNull();
  });
  it('round-trips through formatEvs', () => {
    expect(formatEvs(parseEvs('252 Atk / 4 SpD / 252 Spe')!)).toBe('252 Atk / 4 SpD / 252 Spe');
  });
});

describe('column mapping on the sample Violet sheet', () => {
  const csv = readFileSync('samples/violet-roster.csv', 'utf8');
  const rows = Papa.parse<string[]>(csv, { skipEmptyLines: 'greedy' }).data;
  const mapping = guessMapping(rows[0]);

  it('guesses every column, telling the two "Movimientos" columns apart', () => {
    expect(Object.values(mapping)).toEqual([
      'nationalDex', 'baseSpecies', 'species', 'targetNature', 'targetMoves',
      'currentNature', 'currentMoves', 'ability', 'item', 'origin', 'status',
    ]);
  });

  it('maps a row to named fields and drops empty cells', () => {
    const golem = applyMapping(rows[1], mapping);
    expect(golem.species).toBe('Golem');
    expect(golem.status).toBe('Listo');
    const dragapult = applyMapping(rows[8], mapping);
    expect(dragapult.currentMoves).toBeUndefined();
  });
});

describe('interpretRow', () => {
  it('marks everything done when the status says so', () => {
    const r = interpretRow(
      { nationalDex: '0074', baseSpecies: 'Geodude', species: 'Golem', targetNature: 'Firme (+ataque, -ataque especial)', currentNature: 'Firme (+ataque, -ataque especial)', currentMoves: 'Avalancha, terremoto. Puño fuego, sustituto', ability: 'Robustez', item: 'Cinta fuerte (aumenta daño de ataques físicos)', origin: 'Encontrado', status: 'Listo' },
      0,
      dict
    );
    expect(r.species?.slug).toBe('golem');
    expect(r.baseSpecies?.slug).toBe('geodude');
    expect(r.origin).toBe('CAUGHT');
    expect(r.owned).toBe(true);
    expect(r.item?.slug).toBe('muscle-band');
    expect([r.natureStatus, r.abilityStatus, r.itemStatus]).toEqual(['DONE', 'DONE', 'DONE']);
    expect(r.moves.map((m) => m.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE']);
    expect(r.issues).toEqual([]);
  });

  it('marks only the move named in a "missing" status as pending', () => {
    const r = interpretRow(
      { species: 'Meowscarada', targetNature: 'Alegre', currentNature: 'Alegre', currentMoves: 'Truco floral, carantoña, golpe bajo, ida y vuelta', origin: 'Criado', status: 'Falata golpe bajo' },
      0,
      dict
    );
    expect(r.moves.map((m) => m.status)).toEqual(['DONE', 'DONE', 'PENDING', 'DONE']);
    expect(r.natureStatus).toBe('DONE');
    expect(r.origin).toBe('BRED');
  });

  it('handles a missing move whose name contains "y"', () => {
    const r = interpretRow({ species: 'Meowscarada', currentMoves: 'Truco floral, ida y vuelta', status: 'Falta ida y vuelta' }, 0, dict);
    expect(r.moves.map((m) => m.status)).toEqual(['DONE', 'PENDING']);
  });

  it('treats a planned Pokémon as not owned with everything pending', () => {
    const r = interpretRow({ nationalDex: '0633', baseSpecies: 'Deino', species: 'Heydreigon', targetNature: 'Modesta', targetMoves: 'Pulso dragon, foco resplandor' }, 0, dict);
    expect(r.species?.slug).toBe('hydreigon');
    expect(r.owned).toBe(false);
    expect(r.natureStatus).toBe('PENDING');
    expect(r.moves.every((m) => m.status === 'PENDING')).toBe(true);
    expect(r.issues.map(describeIssue)).toContain('Read "Heydreigon" as Hydreigon');
  });

  it('keeps nature pending when the current one differs, and item alternatives as a note', () => {
    const r = interpretRow(
      { species: 'Archaludon', baseSpecies: 'Duraludon', targetNature: 'Modesta (+At. Esp., -Ataque)', currentNature: 'Plácida (+Defensa, -Velocidad)', currentMoves: 'Cuerpo Cósmico, Pulso Dragón', item: 'Vidasfera / Banda Focus', ability: 'Acérrimo', status: 'Falta cuerpo cósmico' },
      0,
      dict
    );
    expect(r.natureStatus).toBe('PENDING');
    expect(r.item?.slug).toBe('life-orb');
    expect(r.itemNote).toBe('Vidasfera / Banda Focus');
    expect(r.moves[0]).toMatchObject({ match: null, raw: 'Cuerpo Cósmico', status: 'PENDING' });
    expect(r.moves[1].status).toBe('DONE');
  });

  it('falls back to the dex number and refuses rows with no Pokémon', () => {
    expect(interpretRow({ nationalDex: '74' }, 0, dict).species?.slug).toBe('geodude');
    const bad = interpretRow({ species: 'Notamon' }, 0, dict);
    expect(bad.importable).toBe(false);
  });

  describe('obtained', () => {
    const planned = { species: 'Sceptile', baseSpecies: 'Treecko', origin: 'Criado' };

    it('treats a blank status as not obtained when the sheet has a status column', () => {
      expect(interpretRow(planned, 0, dict, { statusColumn: true }).owned).toBe(false);
    });

    it('treats any status text as obtained', () => {
      const r = interpretRow({ ...planned, status: 'Falta golpe bajo' }, 0, dict, { statusColumn: true });
      expect(r.owned).toBe(true);
      expect(interpretRow({ ...planned, status: 'Listo' }, 0, dict, { statusColumn: true }).owned).toBe(true);
    });

    it('lets the status column override an origin or current data', () => {
      const r = interpretRow({ species: 'Golem', currentMoves: 'Terremoto', origin: 'Encontrado' }, 0, dict, { statusColumn: true });
      expect(r.owned).toBe(false);
    });

    it('falls back to origin and current data when there is no status column', () => {
      expect(interpretRow(planned, 0, dict).owned).toBe(true);
      expect(interpretRow({ species: 'Sceptile' }, 0, dict).owned).toBe(false);
    });
  });
});
