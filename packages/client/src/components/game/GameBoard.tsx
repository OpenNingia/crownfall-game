import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../../store/gameStore.js";
import { GameBoardScene } from "../../pixi/GameBoardScene.js";
import { subscribeToGameEvents } from "../../events/gameEventBus.js";
import CardThumbnail from "./CardThumbnail.js";

export default function GameBoard() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameBoardScene | null>(null);
  const boardCards = useGameStore((s) => s.boardCards);
  const currentMonster = useGameStore((s) => s.currentMonster);
  const tavernSize = useGameStore((s) => s.tavernSize);
  const discardSize = useGameStore((s) => s.discardSize);

  // Landing card: the killed monster card that animates onto its destination pile
  const [landingCard, setLandingCard] = useState<{
    cardId: number;
    dest: "tavern" | "discard";
    perfectKill: boolean;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeToGameEvents((event) => {
      if (event.type === "monsterDefeated") {
        setLandingCard({
          cardId: event.monsterId,
          dest: event.perfectKill ? "tavern" : "discard",
          perfectKill: event.perfectKill,
        });
      }
    });
    return unsub;
  }, []);

  // Auto-clear landing card after animation completes
  useEffect(() => {
    if (!landingCard) return;
    const t = setTimeout(() => setLandingCard(null), 1100);
    return () => clearTimeout(t);
  }, [landingCard?.cardId]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new GameBoardScene();
    sceneRef.current = scene;

    scene.init(canvasRef.current).catch(console.error);

    // Subscribe to store changes for PixiJS scene updates (no React re-renders)
    const unsub = useGameStore.subscribe((state) => {
      scene.update(state);
    });

    // Subscribe to game events for kill/victory effects
    const unsubEvents = subscribeToGameEvents((event) => {
      scene.handleGameEvent(event);
    });

    return () => {
      unsub();
      unsubEvents();
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
            <CardThumbnail cardId={currentMonster.cardId} small layoutId={`monster-overlay-${currentMonster.cardId}`} />
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
              <div style={styles.attack}>
                ⚔ {Math.max(0, currentMonster.attack - currentMonster.spadeReduction)} attack
                {currentMonster.spadeReduction > 0 && (
                  <span style={styles.shieldTag}>🛡 -{currentMonster.spadeReduction}</span>
                )}
              </div>
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
          <AnimatePresence>
            {landingCard?.dest === "tavern" && (
              <LandingCard key={`landing-${landingCard.cardId}`} cardId={landingCard.cardId} perfectKill={landingCard.perfectKill} />
            )}
          </AnimatePresence>
          <div style={styles.deckFace}>🂠</div>
          <motion.div
            key={tavernSize}
            style={styles.deckCount}
            initial={{ scale: 1.5, color: "#ffd700" }}
            animate={{ scale: 1, color: "#e6edf3" }}
            transition={{ duration: 0.35 }}
          >
            {tavernSize}
          </motion.div>
          <div style={styles.deckLabel}>Tavern</div>
        </div>
        <div style={styles.deckPile}>
          <AnimatePresence>
            {landingCard?.dest === "discard" && (
              <LandingCard key={`landing-${landingCard.cardId}`} cardId={landingCard.cardId} perfectKill={false} />
            )}
          </AnimatePresence>
          <div style={styles.deckFace}>♻</div>
          <motion.div
            key={discardSize}
            style={styles.deckCount}
            initial={{ scale: 1.5, color: "#8b949e" }}
            animate={{ scale: 1, color: "#e6edf3" }}
            transition={{ duration: 0.35 }}
          >
            {discardSize}
          </motion.div>
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
  attack: { color: "#f85149", fontSize: "0.85rem", marginTop: "0.25rem", display: "flex", gap: "0.4rem", alignItems: "center" },
  shieldTag: { color: "#58a6ff", fontSize: "0.75rem" },
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
  deckPile: { textAlign: "center", position: "relative" },
  deckFace: { fontSize: "2rem" },
  deckCount: { color: "#e6edf3", fontWeight: 700 },
  deckLabel: { color: "#8b949e", fontSize: "0.75rem", textTransform: "uppercase" },
};

// ---------------------------------------------------------------------------
// LandingCard: animated monster card that drops onto a deck pile after kill
// ---------------------------------------------------------------------------

function LandingCard({ cardId, perfectKill }: { cardId: number; perfectKill: boolean }) {
  // Stable tilt direction based on cardId to avoid randomness in render
  const tilt = cardId % 2 === 0 ? -18 : 18;

  return (
    <motion.div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: "50%",
        marginLeft: -22, // half of 44px small card width
        zIndex: 20,
        ...(perfectKill
          ? { filter: "drop-shadow(0 0 6px #ffd700) drop-shadow(0 0 14px rgba(255,215,0,0.6))" }
          : {}),
      }}
      initial={{ y: -50, opacity: 0, rotate: tilt, scale: 0.55 }}
      animate={{ y: 0, opacity: 1, rotate: perfectKill ? 0 : tilt * 0.3, scale: 1 }}
      exit={{ y: 12, opacity: 0, scale: 0.45, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 360, damping: 22 }}
    >
      <CardThumbnail cardId={cardId} small />
    </motion.div>
  );
}
