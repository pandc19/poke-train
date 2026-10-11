import type { UtilityRole } from './index';

const SLEEP_OR_PARALYSIS = [
  'spore', 'sleep-powder', 'hypnosis', 'lovely-kiss', 'sing', 'grass-whistle', 'dark-void',
  'thunder-wave', 'stun-spore', 'glare',
];

export const VIOLET_UTILITY_ROLES: UtilityRole[] = [
  {
    id: 'catcher',
    title: 'Catcher',
    why: 'To catch a Pokémon reliably you weaken it to 1 HP with False Swipe, then put it to sleep or paralyze it before throwing a ball. One Pokémon that knows both does the whole job.',
    needs: { allMoves: ['false-swipe'], anyMoves: SLEEP_OR_PARALYSIS },
    tips: [
      'The Pokémon needs both moves at the same time, so check that it has a free move slot or can forget something.',
      'Auto Battle (the R button) sends your lead out to weaken wild Pokémon for you, which pairs well with False Swipe.',
    ],
  },
  {
    id: 'hatcher',
    title: 'Egg hatcher',
    why: 'A Pokémon with Flame Body, Magma Armor or Steam Engine in your party halves the steps an egg needs, so breeding batches finish much faster.',
    needs: { anyAbilities: ['flame-body', 'magma-armor', 'steam-engine'] },
    tips: [
      'The ability only has to be on the Pokémon in your party, it does not need to be the parent.',
      'Eggs made at a picnic wait in the basket until you take them, so you can collect several and hatch them together.',
    ],
  },
];
