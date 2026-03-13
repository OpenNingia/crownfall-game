import React from "react";
import { useGameStore } from "../../store/gameStore.js";

export default function PlayerStatusBar() {
  const players = useGameStore((s) => s.players);
  const mySessionId = useGameStore((s) => s.mySessionId);
  const discardRequired = useGameStore((s) => s.discardRequired);

  if (!players) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Players</h3>
      {[...players.values()].map((p) => {
        const needsDiscard = discardRequired?.get(p.sessionId) ?? 0;
        const isMe = p.sessionId === mySessionId;
        return (
          <div key={p.sessionId} style={{ ...styles.player, ...(p.isCurrentTurn ? styles.active : {}) }}>
            <div style={styles.nameRow}>
              <span style={styles.name}>
                {p.name}
                {isMe ? " (you)" : ""}
              </span>
              {!p.connected && <span style={styles.offline}>offline</span>}
            </div>
            <div style={styles.stats}>
              <span title="Cards in hand">🃏 {p.handCount}</span>
              <span title="Shields">🛡 {p.shields}</span>
              {needsDiscard > 0 && (
                <span style={styles.discard} title="Must discard">
                  ⚠ {needsDiscard}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "0.75rem",
    height: "100%",
  },
  header: { color: "#8b949e", fontSize: "0.8rem", marginBottom: "0.75rem", textTransform: "uppercase" },
  player: {
    padding: "0.5rem",
    borderRadius: 6,
    marginBottom: "0.5rem",
    background: "#0d1117",
  },
  active: { border: "1px solid #f0c040", background: "#1c1a0e" },
  nameRow: { display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" },
  name: { color: "#e6edf3", fontSize: "0.9rem", fontWeight: 600 },
  offline: { color: "#f85149", fontSize: "0.75rem" },
  stats: { display: "flex", gap: "0.75rem", fontSize: "0.85rem", color: "#8b949e" },
  discard: { color: "#f85149" },
};
