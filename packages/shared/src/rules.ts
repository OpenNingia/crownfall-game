import { JOKER_BLACK, JOKER_RED } from "./constants.js";
import type { Suit } from "./constants.js";
import type { CardInfo } from "./types.js";

export function isJoker(cardId: number): boolean {
  return cardId === JOKER_BLACK || cardId === JOKER_RED;
}

export function getSuit(cardId: number): Suit | "joker" {
  if (isJoker(cardId)) return "joker";
  if (cardId <= 13) return "hearts";
  if (cardId <= 26) return "diamonds";
  if (cardId <= 39) return "clubs";
  return "spades";
}

export function getRank(cardId: number): number {
  if (isJoker(cardId)) return 0;
  return ((cardId - 1) % 13) + 1;
}

export function getCardInfo(cardId: number): CardInfo {
  const suit = getSuit(cardId);
  const rank = getRank(cardId);
  return {
    id: cardId,
    rank,
    suit,
    isJoker: isJoker(cardId),
    isMonster: !isJoker(cardId) && rank >= 11,
  };
}

export function getAttackValue(cardId: number): number {
  if (isJoker(cardId)) return 0;
  const rank = getRank(cardId);
  if (rank === 1) return 1;   // Ace = Animal Companion = 1
  if (rank === 11) return 10; // Jack
  if (rank === 12) return 15; // Queen
  if (rank === 13) return 20; // King
  return rank; // 2–10
}

export function isValidPlay(cardIds: number[]): boolean {
  if (cardIds.length === 0 || cardIds.length > 4) return false;
  const [first, ...rest] = cardIds;

  // Joker must be played alone
  if (isJoker(first)) return cardIds.length === 1;
  if (rest.some(isJoker)) return false;

  const hasAce = getRank(first) === 1 || rest.some((id) => getRank(id) === 1);

  if (hasAce) {
    // Animal Companion: alone, or paired with exactly one other card (any rank)
    return cardIds.length <= 2;
  }

  // Single non-ace card: always valid
  if (rest.length === 0) return true;

  // Combo: same rank, combined attack value ≤ 10
  const firstRank = getRank(first);
  if (!rest.every((id) => getRank(id) === firstRank)) return false;
  const total = cardIds.reduce((sum, id) => sum + getAttackValue(id), 0);
  return total <= 10;
}

export function computeDamage(
  cardIds: number[],
  monsterSuit: Suit,
  immunityNegated: boolean
): number {
  return cardIds.reduce((total, id) => {
    if (isJoker(id)) return total;
    const suit = getSuit(id);
    const base = getAttackValue(id);
    let multiplier = 1;
    if (suit === "clubs") {
      const clubsImmune = monsterSuit === "clubs" && !immunityNegated;
      multiplier = clubsImmune ? 1 : 2;
    }
    return total + base * multiplier;
  }, 0);
}

export type SuitEffect = {
  heartHeal: number;
  diamondDraw: number;
  spadeShield: number;
  jokerNegatesImmunity: boolean;
  jokerClearsBoard: boolean;
};

export function computeSuitEffects(
  cardIds: number[],
  monsterSuit: Suit,
  immunityNegated: boolean
): SuitEffect {
  let heartHeal = 0;
  let diamondDraw = 0;
  let spadeShield = 0;
  let jokerNegatesImmunity = false;
  let jokerClearsBoard = false;

  for (const id of cardIds) {
    if (isJoker(id)) {
      jokerNegatesImmunity = true;
      jokerClearsBoard = true;
      continue;
    }
    const suit = getSuit(id) as Suit;
    const val = getAttackValue(id);
    const isImmune = suit === monsterSuit && !immunityNegated;
    switch (suit) {
      case "hearts":
        if (!isImmune) heartHeal += val;
        break;
      case "diamonds":
        if (!isImmune) diamondDraw += val;
        break;
      case "spades":
        if (!isImmune) spadeShield += val;
        break;
    }
  }

  return { heartHeal, diamondDraw, spadeShield, jokerNegatesImmunity, jokerClearsBoard };
}

export function computeDiscardRequired(monsterAttack: number, totalShields: number): number {
  return Math.max(0, monsterAttack - totalShields);
}
