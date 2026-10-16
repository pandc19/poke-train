'use client';

import { useSyncExternalStore } from 'react';

const EVENT = 'poketrain:dismissed';

/** A hint the player can wave away; remembered on this device. Nothing is hidden on the server render. */
export function useDismissed(key: string): [boolean, () => void] {
  const subscribe = (notify: () => void) => {
    window.addEventListener('storage', notify);
    window.addEventListener(EVENT, notify);
    return () => {
      window.removeEventListener('storage', notify);
      window.removeEventListener(EVENT, notify);
    };
  };
  const dismissed = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(`dismissed:${key}`) === '1';
      } catch {
        return false;
      }
    },
    () => false
  );
  const dismiss = () => {
    try {
      localStorage.setItem(`dismissed:${key}`, '1');
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [dismissed, dismiss];
}
