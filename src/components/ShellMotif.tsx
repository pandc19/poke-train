import type { GameMotif } from '@/lib/games';

/**
 * A game's motif, as a pattern pressed into the shell in the header.
 * Violet looks to the future (Miraidon): circuit traces with nodes.
 * Scarlet looks to the past (Koraidon): carved, stepped stone.
 * Each tile's lines leave one edge where they enter the next, so the pattern runs on unbroken.
 */
const TILES: Record<GameMotif, { w: number; h: number; art: React.ReactNode }> = {
  future: {
    w: 120,
    h: 64,
    art: (
      <>
        <path d="M0 16h28l8 8h30l8-8h46" />
        <path d="M0 48h14l8-8h24l8 8h66" />
        <path d="M66 24v14l6 6h16" />
        <circle cx="91" cy="44" r="2.5" />
        <circle cx="36" cy="24" r="2" />
        <circle cx="100" cy="16" r="2" fill="currentColor" />
      </>
    ),
  },
  ancient: {
    w: 96,
    h: 32,
    art: (
      <>
        <path d="M0 24h8v-8h8v-8h16v8h8v8h56" />
        <path d="M68 9l4 4-4 4-4-4z" />
        <path d="M22 14h4" />
      </>
    ),
  },
};

export function ShellMotif({ motif }: { motif: GameMotif }) {
  const tile = TILES[motif];
  const id = `shell-motif-${motif}`;
  return (
    <svg aria-hidden="true" className="dex-motif">
      <defs>
        <pattern id={id} width={tile.w} height={tile.h} patternUnits="userSpaceOnUse" x="100%">
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            {tile.art}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
