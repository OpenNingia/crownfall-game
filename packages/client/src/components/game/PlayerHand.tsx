import React, { useEffect, useState } from "react";
import { useGameStore } from "../../store/gameStore.js";
import { getSuit, getRank, getAttackValue } from "@crownfall/shared";
import CardThumbnail from "./CardThumbnail.js";

const SUIT_ORDER: Record<string, number> = { hearts: 0, diamonds: 1, clubs: 2, spades: 3 };

export default function PlayerHand() {
  const myPlayer = useGameStore((s) => s.myPlayer());
  const selectedCardIds = useGameStore((s) => s.selectedCardIds);
  const toggleCardSelection = useGameStore((s) => s.toggleCardSelection);

  const storeHand = myPlayer?.hand ?? [];
  const handKey = storeHand.join(",");

  const [localOrder, setLocalOrder] = useState<number[]>(storeHand);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  // Sync localOrder when the hand contents change (cards played/drawn/discarded).
  // Preserves the user's custom order: keeps existing cards in place, appends new ones.
  useEffect(() => {
    setLocalOrder((prev) => {
      const kept = prev.filter((id) => storeHand.includes(id));
      const added = storeHand.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey]);

  // -------------------------------------------------------------------------
  // Sort actions
  // -------------------------------------------------------------------------

  const sortBySuit = () => {
    setLocalOrder((prev) =>
      [...prev].sort((a, b) => {
        const sa = SUIT_ORDER[getSuit(a)] ?? 4;
        const sb = SUIT_ORDER[getSuit(b)] ?? 4;
        return sa !== sb ? sa - sb : getRank(a) - getRank(b);
      })
    );
  };

  const sortByValue = () => {
    setLocalOrder((prev) =>
      [...prev].sort((a, b) => getAttackValue(b) - getAttackValue(a))
    );
  };

  // -------------------------------------------------------------------------
  // Drag handlers
  // -------------------------------------------------------------------------

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    // Set a transparent 1×1 drag image so framer-motion controls the visuals
    const ghost = document.createElement("div");
    ghost.style.cssText = "width:1px;height:1px;position:fixed;top:-10px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      setLocalOrder((prev) => {
        const next = [...prev];
        const from = next.indexOf(draggedId);
        const to = next.indexOf(dragOverId);
        if (from === -1 || to === -1) return prev;
        next.splice(from, 1);
        next.splice(to, 0, draggedId);
        return next;
      });
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!myPlayer) return null;

  const isDragging = draggedId !== null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Your hand ({storeHand.length} cards)</span>
        <div style={styles.sortButtons}>
          <button style={styles.sortBtn} onClick={sortBySuit} title="Sort by suit">
            ♥♦♣♠
          </button>
          <button style={styles.sortBtn} onClick={sortByValue} title="Sort by value">
            A→K
          </button>
        </div>
      </div>

      <div
        style={styles.cards}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {storeHand.length === 0 && (
          <span style={styles.empty}>No cards in hand</span>
        )}

        {localOrder.map((cardId) => {
          const isBeingDragged = draggedId === cardId;
          const isDropTarget = dragOverId === cardId && !isBeingDragged;
          return (
            <div
              key={cardId}
              draggable
              onDragStart={(e) => handleDragStart(e, cardId)}
              onDragOver={(e) => handleDragOver(e, cardId)}
              onDragEnd={handleDragEnd}
              style={{
                ...styles.cardWrapper,
                opacity: isBeingDragged ? 0.3 : 1,
                cursor: isDragging ? "grabbing" : "grab",
                outline: isDropTarget ? "2px solid #58a6ff" : "none",
                borderRadius: 8,
                transition: "opacity 0.12s, outline 0.08s",
              }}
            >
              <CardThumbnail
                cardId={cardId}
                selected={selectedCardIds.includes(cardId)}
                onClick={() => !isDragging && toggleCardSelection(cardId)}
              />
            </div>
          );
        })}
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
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.5rem",
  },
  label: {
    color: "#8b949e",
    fontSize: "0.8rem",
    textTransform: "uppercase",
  },
  sortButtons: {
    display: "flex",
    gap: "0.35rem",
  },
  sortBtn: {
    padding: "0.2rem 0.55rem",
    borderRadius: 5,
    border: "1px solid #30363d",
    background: "#0d1117",
    color: "#8b949e",
    fontSize: "0.75rem",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "border-color 0.15s, color 0.15s",
  },
  cards: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    minHeight: 100,
  },
  cardWrapper: {
    flexShrink: 0,
  },
  empty: {
    color: "#30363d",
    alignSelf: "center",
    margin: "auto",
  },
};
