/**
 * Per-game file logger.
 * Creates one log file per room, retaining the 30 most recent.
 */

import fs from "fs";
import path from "path";
import { getRank, getSuit, isJoker } from "@crownfall/shared";

const LOG_DIR = path.resolve(process.cwd(), "logs", "games");
const MAX_LOGS = 30;

// ---------------------------------------------------------------------------
// Card description helpers
// ---------------------------------------------------------------------------

const RANK_LABEL: Record<number, string> = {
  1: "A", 11: "J", 12: "Q", 13: "K",
};
const SUIT_SYMBOL: Record<string, string> = {
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠",
};

export function descCard(id: number): string {
  if (isJoker(id)) return "Joker";
  const rank = getRank(id);
  const suit = getSuit(id);
  const r = RANK_LABEL[rank] ?? String(rank);
  const s = SUIT_SYMBOL[suit] ?? suit;
  return `${r}${s}`;
}

export function descCards(ids: number[]): string {
  return ids.length === 0 ? "(none)" : ids.map(descCard).join(" ");
}

// ---------------------------------------------------------------------------
// Directory / rotation
// ---------------------------------------------------------------------------

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function pruneOldLogs(): void {
  const files = fs.readdirSync(LOG_DIR)
    .filter((f) => f.endsWith(".log"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime); // oldest first

  while (files.length >= MAX_LOGS) {
    fs.unlinkSync(path.join(LOG_DIR, files.shift()!.name));
  }
}

// ---------------------------------------------------------------------------
// GameLogger
// ---------------------------------------------------------------------------

export class GameLogger {
  private stream: fs.WriteStream;

  constructor(roomId: string) {
    ensureLogDir();
    pruneOldLogs();

    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const filename = `game_${ts}_${roomId}.log`;
    this.stream = fs.createWriteStream(path.join(LOG_DIR, filename), { flags: "a" });
    this.info(`=== Room created — roomId: ${roomId} ===`);
  }

  info(msg: string): void  { this.write("INFO ", msg); }
  warn(msg: string): void  { this.write("WARN ", msg); }
  error(msg: string): void { this.write("ERROR", msg); }

  close(): void {
    this.info("=== Room disposed ===");
    this.stream.end();
  }

  private write(level: string, msg: string): void {
    const ts = new Date().toISOString();
    this.stream.write(`[${ts}] [${level}] ${msg}\n`);
  }
}
