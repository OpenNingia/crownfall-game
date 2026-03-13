/**
 * Card IDs:
 *   1-13:  Hearts   (A=1, 2-10, J=11, Q=12, K=13)
 *  14-26:  Diamonds (A=14, 2=15 … K=26)
 *  27-39:  Clubs    (A=27, 2=28 … K=39)
 *  40-52:  Spades   (A=40, 2=41 … K=52)
 *  53:     Joker Black
 *  54:     Joker Red
 */

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_OFFSET: Record<Suit, number> = {
  hearts: 0,
  diamonds: 13,
  clubs: 26,
  spades: 39,
};

export const JOKER_BLACK = 53;
export const JOKER_RED = 54;

/** Monster stats indexed by rank (J=11, Q=12, K=13) */
export const MONSTER_STATS: Record<number, { hp: number; attack: number }> = {
  11: { hp: 20, attack: 10 }, // Jack
  12: { hp: 30, attack: 15 }, // Queen
  13: { hp: 40, attack: 20 }, // King
};

/** Castle deck order: J♥ J♦ J♣ J♠ Q♥ Q♦ Q♣ Q♠ K♥ K♦ K♣ K♠ */
export const CASTLE_CARD_IDS: number[] = [
  11, 24, 37, 50, // Jacks
  12, 25, 38, 51, // Queens
  13, 26, 39, 52, // Kings
];

export const HAND_SIZES: Record<number, number> = {
  1: 8,
  2: 7,
  3: 6,
  4: 5,
};

/** Number of Jesters (Jokers) in the Tavern deck per player count */
export const JESTER_COUNT: Record<number, number> = {
  1: 0,
  2: 0,
  3: 1,
  4: 2,
};

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
