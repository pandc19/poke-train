/** A dumbbell: marks a Pokémon being trained right now. */
export function TrainingIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M7 12h10M4.5 8.5v7M7 6.5v11M17 6.5v11M19.5 8.5v7" />
    </svg>
  );
}

/** Crossed swords: marks a keeper (finished and kept). Drawn, so it takes the text color wherever it sits. */
export function KeeperIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M6.5 17.5 20 4M4.5 12.5l7 7M3 21l3.5-3.5" />
      <path d="M17.5 17.5 4 4M19.5 12.5l-7 7M21 21l-3.5-3.5" />
    </svg>
  );
}
