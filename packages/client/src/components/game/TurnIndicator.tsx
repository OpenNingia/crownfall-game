import React from "react";
import { useGameStore } from "../../store/gameStore.js";

const PHASE_LABELS: Record<string, string> = {
  playing: "Playing",
  awaiting_discard: "Discard required!",
  awaiting_next_player_select: "Select next player",
};

export default function TurnIndicator() {
  const phase = useGameStore((s) => s.phase);
  const isMyTurn = useGameStore((s) => s.isMyTurn());
  const players = useGameStore((s) => s.players);
  const currentPlayerSessionId = useGameStore((s) => s.currentPlayerSessionId);
  const monstersRemaining = useGameStore((s) => s.monstersRemaining);
  const turnNumber = useGameStore((s) => s.turnNumber);

  const currentPlayerName =
    players?.get(currentPlayerSessionId ?? "")?.name ?? "...";

  return (
    <div style={styles.bar}>
      <span style={styles.turn}>
        Turn {turnNumber} — {PHASE_LABELS[phase ?? ""] ?? phase}
      </span>
      <span style={{ ...styles.active, ...(isMyTurn ? styles.myTurn : {}) }}>
        {isMyTurn ? "Your turn" : `${currentPlayerName}'s turn`}
      </span>
      <span style={styles.monsters}>Monsters left: {monstersRemaining}/12</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "0.5rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.9rem",
  },
  turn: { color: "#8b949e" },
  active: { color: "#e6edf3", fontWeight: 600 },
  myTurn: { color: "#f0c040" },
  monsters: { color: "#8b949e" },
};
