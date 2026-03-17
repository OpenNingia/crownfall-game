import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../../store/gameStore.js";

/**
 * Full-screen sword-slash overlay that plays when the player takes damage
 * (phase → awaiting_discard with a pending discard requirement).
 * Rendered as a fixed overlay — pointer-events: none.
 */
export default function SlashEffect() {
  const phase = useGameStore((s) => s.phase);
  const mySessionId = useGameStore((s) => s.mySessionId);
  const discardRequired = useGameStore((s) => s.discardRequired);

  const myDiscardRequired = mySessionId ? (discardRequired?.get(mySessionId) ?? 0) : 0;
  const [animKey, setAnimKey] = useState(0);
  const [visible, setVisible] = useState(false);
  const hitActiveRef = useRef(false);

  useEffect(() => {
    const isHit = phase === "awaiting_discard" && myDiscardRequired > 0;

    if (isHit && !hitActiveRef.current) {
      hitActiveRef.current = true;
      setAnimKey((k) => k + 1);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 900);
      return () => clearTimeout(t);
    }

    if (!isHit) {
      hitActiveRef.current = false;
    }
  }, [phase, myDiscardRequired]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={animKey}
          style={styles.overlay}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Blood-red vignette flash */}
          <motion.div
            style={styles.vignette}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.3, 0] }}
            transition={{ times: [0, 0.08, 0.45, 1], duration: 0.85, ease: "easeOut" }}
          />

          {/* SVG slash lines */}
          <svg
            style={styles.svg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Red glow layer — wide strokes behind the white core */}
            <Slash x1={8}  y1={0} x2={72} y2={100} stroke="#cc1111" width={4}   opacity={0.55} delay={0}    />
            <Slash x1={20} y1={0} x2={84} y2={100} stroke="#cc1111" width={3.5} opacity={0.45} delay={0.02} />
            <Slash x1={32} y1={0} x2={96} y2={100} stroke="#cc1111" width={3}   opacity={0.35} delay={0.04} />

            {/* White core — crisp thin lines */}
            <Slash x1={8}  y1={0} x2={72} y2={100} stroke="#ffffff" width={1.4} opacity={0.9}  delay={0}    />
            <Slash x1={20} y1={0} x2={84} y2={100} stroke="#ffffff" width={1.1} opacity={0.75} delay={0.02} />
            <Slash x1={32} y1={0} x2={96} y2={100} stroke="#ffffff" width={0.8} opacity={0.55} delay={0.04} />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Single animated slash line
// ---------------------------------------------------------------------------

function Slash({
  x1, y1, x2, y2, stroke, width, opacity, delay,
}: {
  x1: number; y1: number; x2: number; y2: number;
  stroke: string; width: number; opacity: number; delay: number;
}) {
  return (
    <motion.line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{
        pathLength: [0, 1,       1,       1     ],
        opacity:    [0, opacity, opacity, 0     ],
      }}
      transition={{
        times: [0, 0.15, 0.55, 1],
        duration: 0.8,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 200,
  },
  vignette: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse at center, rgba(180,0,0,0.15) 0%, rgba(200,0,0,0.55) 100%)",
  },
  svg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
};
