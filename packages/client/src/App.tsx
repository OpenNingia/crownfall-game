import React from "react";
import { AnimatePresence } from "framer-motion";
import { useGameStore } from "./store/gameStore.js";
import LobbyPage from "./pages/LobbyPage.js";
import GamePage from "./pages/GamePage.js";
import GameOverPage from "./pages/GameOverPage.js";

export default function App() {
  const phase = useGameStore((s) => s.phase);

  return (
    <AnimatePresence mode="wait">
      {(phase === "lobby" || phase === null) && <LobbyPage key="lobby" />}
      {(phase === "playing" ||
        phase === "awaiting_discard" ||
        phase === "awaiting_next_player_select") && <GamePage key="game" />}
      {(phase === "victory" || phase === "defeat") && <GameOverPage key="gameover" />}
    </AnimatePresence>
  );
}
