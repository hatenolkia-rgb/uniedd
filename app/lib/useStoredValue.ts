"use client";

import { useCallback, useSyncExternalStore } from "react";

type StorageArea = "localStorage" | "sessionStorage";

// Values written this page view. Also covers browsers where storage is
// blocked (private mode, disabled cookies) so a choice still sticks until
// the next page load.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(area: StorageArea, key: string): string | null {
  const id = `${area}:${key}`;
  if (memory.has(id)) return memory.get(id)!;
  try {
    return window[area].getItem(key);
  } catch {
    return null;
  }
}

// Reads a browser storage value without a setState-in-effect round trip.
// Returns undefined during server render and hydration (storage isn't known
// yet), then the stored string or null.
export function useStoredValue(area: StorageArea, key: string) {
  const value = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => read(area, key),
    () => undefined
  );

  const setValue = useCallback(
    (next: string) => {
      memory.set(`${area}:${key}`, next);
      try {
        window[area].setItem(key, next);
      } catch {
        // Storage blocked — the in-memory copy still applies.
      }
      listeners.forEach((listener) => listener());
    },
    [area, key]
  );

  return [value, setValue] as const;
}
