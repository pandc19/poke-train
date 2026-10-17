/** The Mint whose stat effect the game shows: one chosen but not yet given changes nothing. */
export const mintInForce = <N>(p: { mintNature: N | null; mintStatus: 'PENDING' | 'DONE' }): N | null =>
  p.mintStatus === 'DONE' ? p.mintNature : null;
