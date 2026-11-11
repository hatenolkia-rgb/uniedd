"use client";

import type { GameDef } from "../catalog";
import { GuitarGames } from "./guitar";
import { PianoGames } from "./piano";
import { VocalGames } from "./vocals";
import { TheoryGames } from "./theory";
import { ClapTrainer } from "../clap/ClapTrainer";

export function PlayGame({ game, onFinish }: { game: GameDef; onFinish: (score: number) => void }) {
  if (game.kind === "clap-trainer") return <ClapTrainer onFinish={onFinish} />;
  if (game.category === "guitar") return <GuitarGames game={game} onFinish={onFinish} />;
  if (game.category === "piano") return <PianoGames game={game} onFinish={onFinish} />;
  if (game.category === "vocals") return <VocalGames game={game} onFinish={onFinish} />;
  return <TheoryGames game={game} onFinish={onFinish} />;
}
