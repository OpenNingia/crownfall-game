import type { Suit } from "./constants.js";

export interface CardInfo {
  id: number;
  rank: number;
  suit: Suit | "joker";
  isJoker: boolean;
  isMonster: boolean;
}

export interface MonsterInfo {
  cardId: number;
  rank: number;
  suit: Suit;
  maxHp: number;
  currentHp: number;
  attack: number;
  immunityNegated: boolean;
  spadeReduction: number; // cumulative spades played against this monster by all players
}

export interface PlayerInfo {
  sessionId: string;
  name: string;
  handCount: number;
  hand: number[];
  shields: number;
  isCurrentTurn: boolean;
  connected: boolean;
  ready: boolean;
}

export type GamePhase =
  | "lobby"
  | "playing"
  | "awaiting_discard"
  | "awaiting_next_player_select"
  | "victory"
  | "defeat";

export interface GameState {
  phase: GamePhase;
  players: Map<string, PlayerInfo>;
  currentMonster: MonsterInfo | null;
  castleDeck: number[];
  boardCards: number[];
  tavernSize: number;
  discardSize: number;
  pendingDamage: number;
  currentPlayerSessionId: string;
  discardRequired: Map<string, number>;
  monstersRemaining: number;
  turnNumber: number;
}

export interface PlayCardsPayload {
  cardIds: number[];
}

export interface DiscardCardsPayload {
  cardIds: number[];
}

export interface SelectNextPlayerPayload {
  sessionId: string;
}

/** Events broadcast from server to all clients for visual feedback. */
export type GameEvent =
  | { type: "monsterDefeated"; monsterId: number; perfectKill: boolean; suit: string }
  | { type: "victory" }
  | { type: "defeat" };
