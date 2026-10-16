/**
 * A Poké Ball, as the games mark a caught Pokémon: red and white when caught,
 * an empty outline when not.
 */
export function PokeBallIcon({ caught, size = 22 }: { caught: boolean; size?: number }) {
  const ink = caught ? '#1b2133' : 'currentColor';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10.25" fill={caught ? '#fff' : 'none'} stroke={ink} strokeWidth="1.75" />
      {caught && <path d="M1.75 12a10.25 10.25 0 0 1 20.5 0z" fill="#e3350d" stroke={ink} strokeWidth="1.75" />}
      <path d="M1.75 12h6.5M15.75 12h6.5" stroke={ink} strokeWidth="1.75" />
      <circle cx="12" cy="12" r="3.25" fill={caught ? '#fff' : 'none'} stroke={ink} strokeWidth="1.75" />
    </svg>
  );
}

/** A large, faint Poké Ball outline drawn behind a caught Pokémon's sprite. */
export function PokeBallMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="0.9">
      <circle cx="12" cy="12" r="11" />
      <path d="M1 12h7.6M15.4 12H23" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}
