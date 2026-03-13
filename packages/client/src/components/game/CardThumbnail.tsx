import React from "react";
import { motion } from "framer-motion";
import { getCardInfo } from "@crownfall/shared";

interface Props {
  cardId: number;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  faceDown?: boolean;
  layoutId?: string; // override the default "card-{cardId}" shared layout id
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
  joker: "★",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "#f85149",
  diamonds: "#f85149",
  clubs: "#e6edf3",
  spades: "#e6edf3",
  joker: "#f0c040",
};

const RANK_LABELS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
  0: "JK",
};

function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}

export default function CardThumbnail({ cardId, selected, onClick, small, faceDown, layoutId: layoutIdProp }: Props) {
  const resolvedLayoutId = layoutIdProp ?? `card-${cardId}`;

  if (faceDown) {
    return (
      <motion.div
        style={{ ...styles.card, ...(small ? styles.small : {}), ...styles.faceDown }}
        layoutId={resolvedLayoutId}
        whileHover={onClick ? { y: -4 } : {}}
      />
    );
  }

  const info = getCardInfo(cardId);
  const suitSymbol = SUIT_SYMBOLS[info.suit];
  const suitColor = SUIT_COLORS[info.suit];
  const label = rankLabel(info.rank);

  return (
    <motion.div
      layout
      layoutId={resolvedLayoutId}
      style={{
        ...styles.card,
        ...(small ? styles.small : {}),
        ...(selected ? styles.selected : {}),
        ...(onClick ? styles.clickable : {}),
      }}
      whileHover={onClick ? { y: -8, scale: 1.05 } : {}}
      whileTap={onClick ? { scale: 0.97 } : {}}
      onClick={onClick}
    >
      <span style={{ ...styles.corner, color: suitColor }}>{label}</span>
      <span style={{ ...styles.suit, color: suitColor }}>{suitSymbol}</span>
      <span style={{ ...styles.cornerBottom, color: suitColor }}>{label}</span>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: 64,
    height: 96,
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "4px 6px",
    position: "relative",
    userSelect: "none",
    flexShrink: 0,
  },
  small: {
    width: 44,
    height: 64,
    borderRadius: 6,
    padding: "3px 4px",
    fontSize: "0.8rem",
  },
  selected: {
    border: "2px solid #f0c040",
    background: "#1c1a0e",
    boxShadow: "0 0 8px rgba(240,192,64,0.4)",
  },
  clickable: { cursor: "pointer" },
  faceDown: {
    background: "repeating-linear-gradient(45deg, #1c2128, #1c2128 4px, #0d1117 4px, #0d1117 8px)",
    cursor: "default",
  },
  corner: { fontSize: "0.85rem", fontWeight: 700 },
  suit: { fontSize: "1.4rem", textAlign: "center" },
  cornerBottom: { fontSize: "0.85rem", fontWeight: 700, alignSelf: "flex-end", transform: "rotate(180deg)" },
};
