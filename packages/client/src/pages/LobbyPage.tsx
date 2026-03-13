import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRoom } from "../colyseus/useRoom.js";
import { useLobbyStore } from "../store/lobbyStore.js";
import { useGameStore } from "../store/gameStore.js";

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function LobbyPage() {
  const { joinOrCreate, send } = useRoom();
  const { playerName, setPlayerName, isJoining, setIsJoining, error, setError } = useLobbyStore();
  const players = useGameStore((s) => s.players);
  const mySessionId = useGameStore((s) => s.mySessionId);
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    if (!playerName.trim()) return;
    setIsJoining(true);
    setError(null);
    try {
      await joinOrCreate(playerName.trim());
      setJoined(true);
    } catch (e: any) {
      setError(e?.message ?? "Connection failed");
    } finally {
      setIsJoining(false);
    }
  };

  const handleReady = () => {
    send("ready");
  };

  const playerList = players ? [...players.values()] : [];
  const myPlayer = mySessionId && players ? players.get(mySessionId) : null;

  return (
    <motion.div
      key="lobby"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      style={styles.container}
    >
      <div style={styles.card}>
        <h1 style={styles.title}>⚔ Crownfall</h1>
        <p style={styles.subtitle}>A cooperative card siege — 2 to 4 players</p>

        {!joined ? (
          <div style={styles.joinForm}>
            <input
              style={styles.input}
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              maxLength={20}
              disabled={isJoining}
            />
            <button style={styles.button} onClick={handleJoin} disabled={isJoining || !playerName.trim()}>
              {isJoining ? "Connecting…" : "Join Game"}
            </button>
            {error && <p style={styles.error}>{error}</p>}
          </div>
        ) : (
          <div style={styles.lobbyRoom}>
            <h2 style={styles.sectionTitle}>Waiting for players…</h2>
            <ul style={styles.playerList}>
              {playerList.map((p) => (
                <li key={p.sessionId} style={styles.playerItem}>
                  <span style={styles.playerName}>
                    {p.name} {p.sessionId === mySessionId ? "(you)" : ""}
                  </span>
                  <span style={{ ...styles.badge, ...(p.ready ? styles.badgeReady : styles.badgeWaiting) }}>
                    {p.ready ? "Ready" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
            <button
              style={{ ...styles.button, ...(myPlayer?.ready ? styles.buttonReady : {}) }}
              onClick={handleReady}
            >
              {myPlayer?.ready ? "Not Ready" : "Ready!"}
            </button>
            <p style={styles.hint}>Need at least 2 players. All must be ready to start.</p>
          </div>
        )}
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
    padding: "2.5rem",
    maxWidth: 480,
    width: "90%",
    textAlign: "center",
  },
  title: { fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "#f0c040" },
  subtitle: { color: "#8b949e", marginBottom: "2rem", fontSize: "1rem" },
  joinForm: { display: "flex", flexDirection: "column", gap: "1rem" },
  input: {
    padding: "0.75rem 1rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    background: "#0d1117",
    color: "#e6edf3",
    fontSize: "1rem",
    outline: "none",
  },
  button: {
    padding: "0.75rem 1.5rem",
    borderRadius: 8,
    border: "none",
    background: "#238636",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonReady: { background: "#6e40c9" },
  error: { color: "#f85149", fontSize: "0.9rem" },
  lobbyRoom: { textAlign: "left" },
  sectionTitle: { textAlign: "center", marginBottom: "1.5rem", color: "#e6edf3" },
  playerList: { listStyle: "none", marginBottom: "1.5rem" },
  playerItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.6rem 0",
    borderBottom: "1px solid #30363d",
  },
  playerName: { color: "#e6edf3" },
  badge: {
    padding: "0.2rem 0.6rem",
    borderRadius: 20,
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  badgeReady: { background: "#238636", color: "#fff" },
  badgeWaiting: { background: "#30363d", color: "#8b949e" },
  hint: { color: "#8b949e", fontSize: "0.8rem", marginTop: "1rem", textAlign: "center" },
};
