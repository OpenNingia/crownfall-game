import React from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../store/gameStore.js";

export default function GameOverPage() {
  const phase = useGameStore((s) => s.phase);
  const isVictory = phase === "victory";

  return (
    <motion.div
      key="gameover"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.4 }}
      style={styles.container}
    >
      <div style={styles.card}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>
          {isVictory ? "👑" : "💀"}
        </div>
        <h1 style={{ ...styles.title, color: isVictory ? "#f0c040" : "#f85149" }}>
          {isVictory ? "Victory!" : "Defeat"}
        </h1>
        <p style={styles.message}>
          {isVictory
            ? "The castle has fallen. The realm is saved!"
            : "Your party has been overwhelmed. Better luck next time."}
        </p>
        <button
          style={styles.button}
          onClick={() => window.location.reload()}
        >
          Play Again
        </button>
      </div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
  },
  card: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 16,
    padding: "3rem",
    textAlign: "center",
    maxWidth: 400,
    width: "90%",
  },
  title: { fontSize: "2.5rem", fontWeight: 700, marginBottom: "1rem" },
  message: { color: "#8b949e", marginBottom: "2rem", lineHeight: 1.6 },
  button: {
    padding: "0.75rem 2rem",
    borderRadius: 8,
    border: "none",
    background: "#238636",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};
