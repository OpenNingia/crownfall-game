import React from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../store/gameStore.js";
import { useRoom } from "../colyseus/useRoom.js";
import GameBoard from "../components/game/GameBoard.js";
import PlayerHand from "../components/game/PlayerHand.js";
import ActionPanel from "../components/game/ActionPanel.js";
import PlayerStatusBar from "../components/game/PlayerStatusBar.js";
import TurnIndicator from "../components/game/TurnIndicator.js";

export default function GamePage() {
  const { send } = useRoom();

  return (
    <motion.div
      key="game"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={styles.layout}
    >
      <div style={styles.header}>
        <TurnIndicator />
      </div>

      <div style={styles.main}>
        <div style={styles.boardArea}>
          <GameBoard />
        </div>
        <div style={styles.sidebar}>
          <PlayerStatusBar />
        </div>
      </div>

      <div style={styles.footer}>
        <PlayerHand />
        <ActionPanel send={send} />
      </div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(180deg, #0d1117 0%, #0a0e14 100%)",
    gap: "0.5rem",
    padding: "0.5rem",
  },
  header: { flex: "0 0 auto" },
  main: {
    flex: "1 1 auto",
    display: "flex",
    gap: "0.5rem",
    minHeight: 0,
  },
  boardArea: { flex: "1 1 auto", minWidth: 0 },
  sidebar: { flex: "0 0 200px" },
  footer: {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
};
