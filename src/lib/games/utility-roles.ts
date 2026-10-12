import type { UtilityRole } from './index';

const SLEEP_OR_PARALYSIS = [
  'spore', 'sleep-powder', 'hypnosis', 'lovely-kiss', 'sing', 'grass-whistle', 'dark-void',
  'thunder-wave', 'stun-spore', 'glare',
];

export const VIOLET_UTILITY_ROLES: UtilityRole[] = [
  {
    id: 'catcher',
    title: { en: 'Catcher', es: 'Capturador' },
    why: {
      en: 'To catch a Pokémon reliably you weaken it to 1 HP with False Swipe, then put it to sleep or paralyze it before throwing a ball. One Pokémon that knows both does the whole job.',
      es: 'Para capturar un Pokémon con fiabilidad lo debilitas hasta dejarlo con 1 PS usando Falso Tortazo, y luego lo duermes o lo paralizas antes de lanzar la bola. Un solo Pokémon que sepa ambos movimientos hace todo el trabajo.',
    },
    needs: { allMoves: ['false-swipe'], anyMoves: SLEEP_OR_PARALYSIS },
    tips: [
      {
        en: 'The Pokémon needs both moves at the same time, so check that it has a free move slot or can forget something.',
        es: 'El Pokémon necesita ambos movimientos a la vez, así que comprueba que tenga un hueco libre o que pueda olvidar otro.',
      },
      {
        en: 'Auto Battle (the R button) sends your lead out to weaken wild Pokémon for you, which pairs well with False Swipe.',
        es: 'El combate automático (botón R) envía a tu Pokémon líder a debilitar Pokémon salvajes por ti, y combina muy bien con Falso Tortazo.',
      },
    ],
  },
  {
    id: 'hatcher',
    title: { en: 'Egg hatcher', es: 'Incubador de huevos' },
    why: {
      en: 'A Pokémon with Flame Body, Magma Armor or Steam Engine in your party halves the steps an egg needs, so breeding batches finish much faster.',
      es: 'Un Pokémon con Cuerpo Llama, Armadura Magma o Combustible en tu equipo reduce a la mitad los pasos que necesita un huevo, así que las tandas de crianza terminan mucho antes.',
    },
    needs: { anyAbilities: ['flame-body', 'magma-armor', 'steam-engine'] },
    tips: [
      {
        en: 'The ability only has to be on the Pokémon in your party, it does not need to be the parent.',
        es: 'La habilidad solo tiene que estar en un Pokémon de tu equipo, no hace falta que sea el progenitor.',
      },
      {
        en: 'Eggs made at a picnic wait in the basket until you take them, so you can collect several and hatch them together.',
        es: 'Los huevos que salen en un picnic esperan en la cesta hasta que los recoges, así que puedes juntar varios e incubarlos a la vez.',
      },
    ],
  },
];
