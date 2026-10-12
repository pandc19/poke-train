'use client';

import { useEffect, useState } from 'react';
import type { LocationResult } from '@/lib/ai/schema';

/**
 * Location lookups already researched for these species (no new AI request is
 * made), so an answer survives a page reload. Keyed by species id.
 */
export function useCachedLocations(gameId: string | undefined, speciesIds: number[]): Record<number, LocationResult> {
  const [found, setFound] = useState<Record<number, LocationResult>>({});
  const key = [...new Set(speciesIds)].sort((a, b) => a - b).join(',');

  useEffect(() => {
    if (!gameId || !key) return;
    const controller = new AbortController();
    fetch(`/api/ai/location?gameId=${encodeURIComponent(gameId)}&speciesIds=${key}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { results?: Record<number, LocationResult> } | null) => {
        if (data?.results) setFound((prev) => ({ ...prev, ...data.results }));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [gameId, key]);

  return found;
}
