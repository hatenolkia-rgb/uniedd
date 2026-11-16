"use client";
// Board theme + piece set, remembered in localStorage and shared live between
// the style picker and every board on the page.
import { useSyncExternalStore } from "react";
import { DEFAULT_PIECE_SET_ID, DEFAULT_THEME_ID, FX_KEY, PIECES_KEY, THEME_KEY, getPieceSet, getTheme } from "./themes";

const EVENT = "uniedd-chess-prefs";

function read(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: keep it for this page view only
    memory[key] = value;
  }
  window.dispatchEvent(new Event(EVENT));
}

const memory: Record<string, string> = {};

export function useChessPrefs() {
  const themeId = useSyncExternalStore(subscribe, () => memory[THEME_KEY] ?? read(THEME_KEY, DEFAULT_THEME_ID), () => DEFAULT_THEME_ID);
  const pieceSetId = useSyncExternalStore(subscribe, () => memory[PIECES_KEY] ?? read(PIECES_KEY, DEFAULT_PIECE_SET_ID), () => DEFAULT_PIECE_SET_ID);
  const fx = useSyncExternalStore(subscribe, () => memory[FX_KEY] ?? read(FX_KEY, "on"), () => "on");
  return {
    captureFx: fx !== "off",
    setCaptureFx: (on: boolean) => save(FX_KEY, on ? "on" : "off"),
    theme: getTheme(themeId),
    pieceSet: getPieceSet(pieceSetId),
    setTheme: (id: string) => save(THEME_KEY, getTheme(id).id),
    setPieceSet: (id: string) => save(PIECES_KEY, getPieceSet(id).id),
  };
}

/** True when the visitor asked their device for less motion. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      mq?.addEventListener?.("change", cb);
      return () => mq?.removeEventListener?.("change", cb);
    },
    () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
