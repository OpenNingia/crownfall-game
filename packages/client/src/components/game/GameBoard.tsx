import React, { useEffect, useRef } from "react";
import { useGameStore } from "../../store/gameStore.js";
import { GameBoardScene } from "../../pixi/GameBoardScene.js";
import CardThumbnail from "./CardThumbnail.js";

export default function GameBoard() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameBoardScene | null>(null);
  const boardCards = useGameStore((s) => s.boardCards);
  const currentMonster = useGameStore((s) => s.currentMonster);
  const tavernSize = useGameStore((s) => s.tavernSize);
  const discardSize = useGameStore((s) => s.discardSize);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new GameBoardScene();
    sceneRef.current = scene;

    scene.init(canvasRef.current).catch(console.error);

    // Subscribe to store changes for PixiJS scene updates (no React re-renders)
    const unsub = useGameStore.subscribe((state) => {
      scene.update(state);
    });

    return () => {
      unsub();
      scene.destroy();
    };
  }, []);

  return (
    <div style={styles.board}>
      {/* PixiJS canvas target */}
      <div ref={canvasRef} style={styles.pixiContainer} />

      {/* React overlay for monster info (PixiJS handles the canvas visuals) */}
      {currentMonster && (
        <div style={styles.monsterOverlay}>
          <div style={styles.monsterCard}>
            <CardThumbnail cardId={currentMonster.cardId} small />
            <div style={styles.monsterInfo}>
              <div style={styles.monsterName}>
                {currentMonster.suit.toUpperCase()} {rankLabel(currentMonster.rank)}
              </div>
              <div style={styles.hpBar}>
                <div
                  style={{
                    ...styles.hpFill,
                    width: `${Math.max(0, (currentMonster.currentHp / currentMonster.maxHp) * 100)}%`,
                    background: hpColor(currentMonster.currentHp, currentMonster.maxHp),
                  }}
                />
              </div>
              <div style={styles.hpText}>
                {Math.max(0, currentMonster.currentHp)} / {currentMonster.maxHp} HP
              </div>
              <div style={styles.attack}>⚔ {currentMonster.attack} attack</div>
              {currentMonster.immunityNegated && (
                <div style={styles.immunityTag}>Immunity negated</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Board cards area */}
      <div style={styles.boardCards}>
        <div style={styles.pileLabel}>Board</div>
        <div style={styles.cardRow}>
          {boardCards && boardCards.length === 0 && (
            <span style={styles.emptyPile}>Empty</span>
          )}
          {boardCards?.map((id) => (
            <CardThumbnail key={id} cardId={id} small />
          ))}
        </div>
      </div>

      {/* Deck counters */}
      <div style={styles.decks}>
        <div style={styles.deckPile}>
          <div style={styles.deckFace}>🂠</div>
          <div style={styles.deckCount}>{tavernSize}</div>
          <div style={styles.deckLabel}>Tavern</div>
        </div>
        <div style={styles.deckPile}>
          <div style={styles.deckFace}>♻</div>
          <div style={styles.deckCount}>{discardSize}</div>
          <div style={styles.deckLabel}>Discard</div>
        </div>
      </div>
    </div>
  );
}

function rankLabel(rank: number): string {
  return { 11: "Jack", 12: "Queen", 13: "King" }[rank] ?? String(rank);
}

function hpColor(current: number, max: number): string {
  const pct = current / max;
  if (pct > 0.5) return "#238636";
  if (pct > 0.25) return "#d29922";
  return "#f85149";
}

const styles: Record<string, React.CSSProperties> = {
  board: {
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 12,
    height: "100%",
    minHeight: 300,
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.75rem",
  },
  pixiContainer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: 0.3, // subtle background effect
  },
  monsterOverlay: {
    position: "relative",
    zIndex: 1,
  },
  monsterCard: {
    display: "flex",
    gap: "1rem",
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "0.75rem",
    alignItems: "center",
  },
  monsterInfo: { flex: 1 },
  monsterName: { color: "#e6edf3", fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" },
  hpBar: {
    height: 8,
    background: "#30363d",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: "0.25rem",
  },
  hpFill: { height: "100%", borderRadius: 4, transition: "width 0.4s ease" },
  hpText: { color: "#8b949e", fontSize: "0.85rem" },
  attack: { color: "#f85149", fontSize: "0.85rem", marginTop: "0.25rem" },
  immunityTag: {
    display: "inline-block",
    marginTop: "0.25rem",
    padding: "0.1rem 0.4rem",
    background: "#6e40c9",
    color: "#fff",
    borderRadius: 4,
    fontSize: "0.75rem",
  },
  boardCards: {
    flex: "1 1 auto",
    position: "relative",
    zIndex: 1,
  },
  pileLabel: { color: "#8b949e", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.4rem" },
  cardRow: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  emptyPile: { color: "#30363d", fontSize: "0.9rem" },
  decks: {
    display: "flex",
    gap: "1rem",
    position: "relative",
    zIndex: 1,
  },
  deckPile: { textAlign: "center" },
  deckFace: { fontSize: "2rem" },
  deckCount: { color: "#e6edf3", fontWeight: 700 },
  deckLabel: { color: "#8b949e", fontSize: "0.75rem", textTransform: "uppercase" },
};
