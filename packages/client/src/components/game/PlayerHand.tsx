import React from "react";
import { useGameStore } from "../../store/gameStore.js";
import CardThumbnail from "./CardThumbnail.js";

export default function PlayerHand() {
  const myPlayer = useGameStore((s) => s.myPlayer());
  const selectedCardIds = useGameStore((s) => s.selectedCardIds);
  const toggleCardSelection = useGameStore((s) => s.toggleCardSelection);

  if (!myPlayer) return null;

  const hand = myPlayer.hand ?? [];

  return (
    <div style={styles.container}>
      <div style={styles.label}>Your hand ({hand.length} cards)</div>
      <div style={styles.cards}>
        {hand.length === 0 && <span style={styles.empty}>No cards in hand</span>}
        {hand.map((cardId) => (
          <CardThumbnail
            key={cardId}
            cardId={cardId}
            selected={selectedCardIds.includes(cardId)}
            onClick={() => toggleCardSelection(cardId)}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "0.75rem",
  },
  label: { color: "#8b949e", fontSize: "0.8rem", marginBottom: "0.5rem", textTransform: "uppercase" },
  cards: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    minHeight: 100,
  },
  empty: { color: "#30363d", alignSelf: "center", margin: "auto" },
};
