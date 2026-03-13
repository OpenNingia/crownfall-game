import React from "react";
import { useGameStore } from "../../store/gameStore.js";
import { isValidPlay, getAttackValue } from "@crownfall/shared";

interface Props {
  send: (type: string, payload?: unknown) => void;
}

export default function ActionPanel({ send }: Props) {
  const phase = useGameStore((s) => s.phase);
  const isMyTurn = useGameStore((s) => s.isMyTurn());
  const selectedCardIds = useGameStore((s) => s.selectedCardIds);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const mySessionId = useGameStore((s) => s.mySessionId);
  const discardRequired = useGameStore((s) => s.discardRequired);
  const players = useGameStore((s) => s.players);

  const myDiscardRequired = mySessionId ? (discardRequired?.get(mySessionId) ?? 0) : 0;
  const selectedValue = selectedCardIds.reduce((sum, id) => sum + getAttackValue(id), 0);
  const canPlay = phase === "playing" && isMyTurn && isValidPlay(selectedCardIds);
  const canDiscard =
    phase === "awaiting_discard" &&
    myDiscardRequired > 0 &&
    selectedValue >= myDiscardRequired;

  const handlePlay = () => {
    console.log(`handlePlay. canPlay: ${canPlay}, selectedCards: ${selectedCardIds}`)
    if (!canPlay) return;
    send("playCards", { cardIds: selectedCardIds });
    clearSelection();
  };

  const handleDiscard = () => {
    if (!canDiscard) return;
    send("discardCards", { cardIds: selectedCardIds });
    clearSelection();
  };

  if (phase === "awaiting_next_player_select" && isMyTurn) {
    const otherPlayers = players ? [...players.values()].filter((p) => p.sessionId !== mySessionId) : [];
    return (
      <div style={styles.panel}>
        <span style={styles.label}>Select the next player:</span>
        <div style={styles.playerButtons}>
          {otherPlayers.map((p) => (
            <button
              key={p.sessionId}
              style={styles.playerBtn}
              onClick={() => send("selectNextPlayer", { sessionId: p.sessionId })}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.selectionInfo}>
        {selectedCardIds.length > 0 ? (
          <span style={styles.selected}>{selectedCardIds.length} card(s) selected</span>
        ) : (
          <span style={styles.hint}>Select cards from your hand</span>
        )}
      </div>

      <div style={styles.buttons}>
        {phase === "playing" && isMyTurn && (
          <button
            style={{ ...styles.btn, ...(canPlay ? styles.btnPlay : styles.btnDisabled) }}
            onClick={handlePlay}
            disabled={!canPlay}
          >
            Play
          </button>
        )}

        {phase === "awaiting_discard" && myDiscardRequired > 0 && (
          <button
            style={{ ...styles.btn, ...(canDiscard ? styles.btnDiscard : styles.btnDisabled) }}
            onClick={handleDiscard}
            disabled={!canDiscard}
          >
            Discard ({myDiscardRequired} required)
          </button>
        )}

        {selectedCardIds.length > 0 && (
          <button style={{ ...styles.btn, ...styles.btnClear }} onClick={clearSelection}>
            Clear
          </button>
        )}
      </div>

      {!isMyTurn && phase === "playing" && (
        <span style={styles.waiting}>Waiting for other players…</span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "0.75rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
  },
  selectionInfo: { flex: "1 1 auto" },
  selected: { color: "#f0c040", fontWeight: 600 },
  hint: { color: "#30363d" },
  buttons: { display: "flex", gap: "0.5rem" },
  btn: { padding: "0.5rem 1.25rem", borderRadius: 6, border: "none", fontWeight: 600, cursor: "pointer" },
  btnPlay: { background: "#238636", color: "#fff" },
  btnDiscard: { background: "#b91c1c", color: "#fff" },
  btnClear: { background: "#30363d", color: "#8b949e" },
  btnDisabled: { background: "#21262d", color: "#30363d", cursor: "not-allowed" },
  waiting: { color: "#8b949e", fontSize: "0.9rem" },
  label: { color: "#e6edf3", fontWeight: 600 },
  playerButtons: { display: "flex", gap: "0.5rem" },
  playerBtn: {
    padding: "0.4rem 1rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    background: "#0d1117",
    color: "#e6edf3",
    cursor: "pointer",
  },
};
