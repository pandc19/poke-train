import type { StarterRole } from './index';

/**
 * Hand-written early-game utility cores. Kept deliberately short: only
 * widely known picks, and a location only where it is well established.
 * Anything else is looked up on demand ("Where?") rather than guessed here.
 */
export const VIOLET_STARTER_ROLES: StarterRole[] = [
  {
    id: 'story',
    title: 'Story core',
    why: 'Reliable early Pokémon that stay useful through all three story paths.',
    picks: [
      { slug: 'fuecoco', note: 'Evolves into Skeledirge (Fire/Ghost): bulky, and Torch Song raises its Special Attack every use.', where: 'Starter choice' },
      { slug: 'pawmi', note: 'Fast early Electric type. As Pawmot it learns Revival Blessing, which revives a fainted teammate.', where: 'South Province (Area One)' },
      { slug: 'tinkatink', note: 'Fairy/Steel has very few weaknesses. Tinkaton gets Gigaton Hammer.', where: 'South Province (Area Two)' },
      { slug: 'azurill', note: 'Azumarill with Huge Power hits far harder than its stats suggest.' },
    ],
    tips: ['Let your team auto-battle with the R button to gather TM materials while you explore.'],
  },
  {
    id: 'ev',
    title: 'EV training',
    why: 'Scarlet and Violet have no horde battles, so EV training is done with held Power items and vitamins.',
    picks: [],
    tips: [
      'Buy the Power items (Weight, Bracer, Belt, Lens, Band, Anklet) at Delibird Presents. Holding one adds 8 EVs of its stat to every Pokémon you knock out.',
      'Vitamins from Chansey Supply give 10 EVs each and work all the way to 252, so money can replace grinding.',
      'Use the roster\'s EV chip to tick a spread off once it is finished; EV-reducing berries fix mistakes.',
    ],
  },
  {
    id: 'catching',
    title: 'Catching',
    why: 'False Swipe leaves the target at 1 HP and a sleep move multiplies the catch rate.',
    picks: [
      { slug: 'ralts', note: 'A male Kirlia evolves into Gallade with a Dawn Stone: False Swipe, Hypnosis and Thunder Wave on one Pokémon.', where: 'South Province (Area One)' },
      { slug: 'shroomish', note: 'Breloom learns Spore (100% accurate sleep) and False Swipe. Keep it as Shroomish until it learns Spore.' },
    ],
    tips: ['False Swipe is TM057. You get it from Jacq, the biology teacher, after registering 30 Pokémon.'],
  },
  {
    id: 'hatching',
    title: 'Egg hatching',
    why: 'A Pokémon with Flame Body in the party halves the steps every egg needs.',
    picks: [
      { slug: 'fletchling', note: 'Fletchinder and Talonflame have Flame Body, and it is one of the first Pokémon you meet.', where: 'South Province (Area One)' },
      { slug: 'rolycoly', note: 'Carkol and Coalossal can have Flame Body or Steam Engine; both speed up hatching.', where: 'East Province (Area One)' },
      { slug: 'larvesta', note: 'Larvesta and Volcarona have Flame Body and double as a strong sweeper.' },
    ],
    tips: [
      'Eat a sandwich with Egg Power before a picnic to make eggs appear faster.',
      'Carry the Flame Body Pokémon plus five eggs and ride in circles to hatch a full batch at once.',
    ],
  },
];
