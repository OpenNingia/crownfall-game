/**
 * GameEngine — pure game logic, no schema/IO dependencies.
 * All mutations happen on plain JS objects passed in and returned out.
 */

import {
  isValidPlay,
  computeDamage,
  computeSuitEffects,
  computeDiscardRequired,
  getSuit,
  getRank,
  isJoker,
  getAttackValue,
  MONSTER_STATS,
  HAND_SIZES,
  JOKER_BLACK,
  JOKER_RED,
} from "@crownfall/shared";
import type { Suit } from "@crownfall/shared";
import { buildTavernDeck, buildCastleDeck, shuffle } from "./Deck.js";

// ---------------------------------------------------------------------------
// Types (plain JS, no schema)
// ---------------------------------------------------------------------------

export interface EngineMonster {
  cardId: number;
  rank: number;
  suit: Suit;
  maxHp: number;
  currentHp: number;
  attack: number;
  immunityNegated: boolean;
}

export interface EnginePlayer {
  sessionId: string;
  name: string;
  hand: number[];
  shields: number;
  connected: boolean;
  ready: boolean;
}

export type EnginePhase =
  | "lobby"
  | "playing"
  | "awaiting_discard"
  | "awaiting_next_player_select"
  | "victory"
  | "defeat";

export interface EngineState {
  phase: EnginePhase;
  players: Map<string, EnginePlayer>;
  playerOrder: string[]; // sessionId order (turn rotation)
  currentMonster: EngineMonster;
  castleDeck: number[];
  tavern: number[];
  discard: number[];
  boardCards: number[];
  pendingDamage: number;
  currentPlayerSessionId: string;
  discardRequired: Map<string, number>; // sessionId → cards to discard
  monstersRemaining: number;
  turnNumber: number;
}

// ---------------------------------------------------------------------------
// Engine operations (all return a new/mutated EngineState)
// ---------------------------------------------------------------------------

export function initGame(players: { sessionId: string; name: string }[]): EngineState {
  const tavern = buildTavernDeck();
  const castleDeck = buildCastleDeck();
  const playerCount = players.length;
  const handSize = HAND_SIZES[playerCount] ?? 6;

  const playerMap = new Map<string, EnginePlayer>();
  const playerOrder: string[] = [];

  for (const p of players) {
    const hand = tavern.splice(0, handSize);
    playerMap.set(p.sessionId, {
      sessionId: p.sessionId,
      name: p.name,
      hand,
      shields: 0,
      connected: true,
      ready: true,
    });
    playerOrder.push(p.sessionId);
  }

  // First monster
  const firstMonsterId = castleDeck.shift()!;
  const monster = makeMonster(firstMonsterId);

  return {
    phase: "playing",
    players: playerMap,
    playerOrder,
    currentMonster: monster,
    castleDeck,
    tavern,
    discard: [],
    boardCards: [],
    pendingDamage: 0,
    currentPlayerSessionId: playerOrder[0],
    discardRequired: new Map(),
    monstersRemaining: 12,
    turnNumber: 1,
  };
}

function makeMonster(cardId: number): EngineMonster {
  const rank = getRank(cardId);
  const suit = getSuit(cardId) as Suit;
  const stats = MONSTER_STATS[rank]!;
  return {
    cardId,
    rank,
    suit,
    maxHp: stats.hp,
    currentHp: stats.hp,
    attack: stats.attack,
    immunityNegated: false,
  };
}

// ---------------------------------------------------------------------------
// playCards — main play action
// ---------------------------------------------------------------------------

export interface PlayResult {
  state: EngineState;
  error?: string;
  events: PlayEvent[];
}

export type PlayEvent =
  | { type: "monsterDefeated"; monsterId: number }
  | { type: "victory" }
  | { type: "defeat" }
  | { type: "jokerPlayed" }
  | { type: "draw"; count: number }
  | { type: "heal"; count: number }
  | { type: "shields"; amount: number }
  | { type: "discardPhase"; required: Map<string, number> }
  | { type: "nextPlayerSelectPhase" };

export function playCards(state: EngineState, sessionId: string, cardIds: number[]): PlayResult {
  const events: PlayEvent[] = [];

  if (state.phase !== "playing") {
    return { state, error: "Not in playing phase", events };
  }
  if (state.currentPlayerSessionId !== sessionId) {
    return { state, error: "Not your turn", events };
  }

  const player = state.players.get(sessionId)!;

  // Validate cards exist in hand
  for (const id of cardIds) {
    if (!player.hand.includes(id)) {
      return { state, error: `Card ${id} not in hand`, events };
    }
  }

  if (!isValidPlay(cardIds)) {
    return { state, error: "Invalid play", events };
  }

  // Remove cards from hand
  for (const id of cardIds) {
    const idx = player.hand.indexOf(id);
    player.hand.splice(idx, 1);
  }

  // Handle Joker specially
  if (cardIds.length === 1 && isJoker(cardIds[0])) {
    return handleJoker(state, sessionId, cardIds[0], events);
  }

  // Place on board
  state.boardCards.push(...cardIds);

  const monster = state.currentMonster;

  // Compute suit effects
  const effects = computeSuitEffects(cardIds, monster.suit, monster.immunityNegated);

  // Apply joker flags (won't trigger here since jokers handled above, but kept for safety)
  if (effects.jokerNegatesImmunity) {
    monster.immunityNegated = true;
  }

  // Clubs immunity negate already in immunityNegated flag — computeDamage uses it
  const damage = computeDamage(cardIds, monster.suit, monster.immunityNegated);
  state.pendingDamage += damage;

  // Apply Hearts: heal from discard pile back to tavern
  if (effects.heartHeal > 0) {
    const healed = recycleFromDiscard(state, effects.heartHeal);
    if (healed > 0) events.push({ type: "heal", count: healed });
  }

  // Apply Diamonds: draw cards
  if (effects.diamondDraw > 0) {
    const drawn = drawCards(state, sessionId, effects.diamondDraw);
    if (drawn > 0) events.push({ type: "draw", count: drawn });
  }

  // Apply Spades: shields
  if (effects.spadeShield > 0) {
    player.shields += effects.spadeShield;
    events.push({ type: "shields", amount: effects.spadeShield });
  }

  // Apply damage to monster
  monster.currentHp -= damage;

  if (monster.currentHp <= 0) {
    return handleMonsterDefeated(state, sessionId, events);
  }

  // Monster retaliates after each play
  return handleMonsterAttack(state, sessionId, events);
}

function handleJoker(
  state: EngineState,
  sessionId: string,
  _jokerId: number,
  events: PlayEvent[]
): PlayResult {
  // Joker: discard all board cards, negate clubs immunity next turn
  state.discard.push(...state.boardCards);
  state.boardCards = [];
  state.pendingDamage = 0;
  state.currentMonster.immunityNegated = true;

  events.push({ type: "jokerPlayed" });
  // Player who played joker selects who goes next
  state.phase = "awaiting_next_player_select";
  events.push({ type: "nextPlayerSelectPhase" });

  return { state, events };
}

function handleMonsterDefeated(
  state: EngineState,
  sessionId: string,
  events: PlayEvent[]
): PlayResult {
  const monsterId = state.currentMonster.cardId;
  events.push({ type: "monsterDefeated", monsterId });

  // Move board cards to discard
  state.discard.push(...state.boardCards);
  state.boardCards = [];
  state.pendingDamage = 0;
  state.monstersRemaining--;

  // Victory check
  if (state.castleDeck.length === 0 && state.monstersRemaining === 0) {
    state.phase = "victory";
    events.push({ type: "victory" });
    return { state, events };
  }

  if (state.castleDeck.length > 0) {
    const nextMonsterId = state.castleDeck.shift()!;
    state.currentMonster = makeMonster(nextMonsterId);
  }

  // Advance turn — same player who defeated goes next (or next player, per Regicide rules: same player continues)
  // In Regicide: after defeating a monster the same player continues their turn against the new monster
  // So we don't rotate here — the same player plays again

  return { state, events };
}

function handleMonsterAttack(
  state: EngineState,
  sessionId: string,
  events: PlayEvent[]
): PlayResult {
  const monster = state.currentMonster;
  const player = state.players.get(sessionId)!;

  const discardNeeded = computeDiscardRequired(monster.attack, player.shields);

  if (discardNeeded === 0) {
    advanceTurn(state);
    return { state, events };
  }

  if (discardNeeded > player.hand.length) {
    state.phase = "defeat";
    events.push({ type: "defeat" });
    return { state, events };
  }

  const required = new Map([[sessionId, discardNeeded]]);
  state.discardRequired = required;
  state.phase = "awaiting_discard";
  events.push({ type: "discardPhase", required });

  return { state, events };
}

// ---------------------------------------------------------------------------
// discardCards — discard phase
// ---------------------------------------------------------------------------

export interface DiscardResult {
  state: EngineState;
  error?: string;
}

export function discardCards(
  state: EngineState,
  sessionId: string,
  cardIds: number[]
): DiscardResult {
  if (state.phase !== "awaiting_discard") {
    return { state, error: "Not in discard phase" };
  }

  const required = state.discardRequired.get(sessionId);
  if (required === undefined || required === 0) {
    return { state, error: "You don't need to discard" };
  }
  if (cardIds.length !== required) {
    return { state, error: `Must discard exactly ${required} cards` };
  }

  const player = state.players.get(sessionId)!;
  for (const id of cardIds) {
    if (!player.hand.includes(id)) {
      return { state, error: `Card ${id} not in hand` };
    }
  }

  // Remove from hand and add to discard
  for (const id of cardIds) {
    const idx = player.hand.indexOf(id);
    player.hand.splice(idx, 1);
  }
  state.discard.push(...cardIds);

  // Clear this player's requirement
  state.discardRequired.delete(sessionId);

  // Check if all requirements satisfied → advance turn
  if (state.discardRequired.size === 0) {
    advanceTurn(state);
  }

  return { state };
}

// ---------------------------------------------------------------------------
// selectNextPlayer — joker followup
// ---------------------------------------------------------------------------

export interface SelectNextPlayerResult {
  state: EngineState;
  error?: string;
}

export function selectNextPlayer(
  state: EngineState,
  callerSessionId: string,
  targetSessionId: string
): SelectNextPlayerResult {
  if (state.phase !== "awaiting_next_player_select") {
    return { state, error: "Not in next-player-select phase" };
  }
  if (!state.players.has(targetSessionId)) {
    return { state, error: "Invalid player" };
  }

  state.currentPlayerSessionId = targetSessionId;
  state.phase = "playing";
  state.turnNumber++;

  return { state };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function advanceTurn(state: EngineState): void {
  // Reset only the active player's shields (they protected this turn's attack)
  const current = state.players.get(state.currentPlayerSessionId);
  if (current) current.shields = 0;

  const currentIdx = state.playerOrder.indexOf(state.currentPlayerSessionId);
  const nextIdx = (currentIdx + 1) % state.playerOrder.length;
  state.currentPlayerSessionId = state.playerOrder[nextIdx];
  state.phase = "playing";
  state.turnNumber++;
}

function drawCards(state: EngineState, sessionId: string, count: number): number {
  const player = state.players.get(sessionId)!;
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (state.tavern.length === 0) break;
    player.hand.push(state.tavern.shift()!);
    drawn++;
  }
  return drawn;
}

function recycleFromDiscard(state: EngineState, count: number): number {
  // Take from end of discard pile, shuffle back into tavern
  const recycled = state.discard.splice(-count);
  const shuffled = shuffle(recycled);
  state.tavern.unshift(...shuffled);
  return recycled.length;
}

// ---------------------------------------------------------------------------
// addPlayer / removePlayer
// ---------------------------------------------------------------------------

export function addPlayer(state: EngineState, sessionId: string, name: string): void {
  state.players.set(sessionId, {
    sessionId,
    name,
    hand: [],
    shields: 0,
    connected: true,
    ready: false,
  });
  state.playerOrder.push(sessionId);
}

export function removePlayer(state: EngineState, sessionId: string): void {
  state.players.delete(sessionId);
  const idx = state.playerOrder.indexOf(sessionId);
  if (idx !== -1) state.playerOrder.splice(idx, 1);
}
