import { CASTLE_CARD_IDS, JOKER_BLACK, JOKER_RED } from "@crownfall/shared";
// Note: @crownfall/shared resolves to packages/shared/src/index via tsconfig paths

/** Fisher-Yates shuffle (in-place) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Returns the full 54-card deck (no monsters, no face cards) shuffled.
 * Castle deck (monsters) is kept separate and ordered J→Q→K by suit.
 */
export function buildTavernDeck(): number[] {
  const monsterSet = new Set(CASTLE_CARD_IDS);
  const tavern: number[] = [];

  // Cards 1–52 that are not monsters
  for (let id = 1; id <= 52; id++) {
    if (!monsterSet.has(id)) {
      tavern.push(id);
    }
  }

  // Add 2 jokers
  tavern.push(JOKER_BLACK, JOKER_RED);

  return shuffle(tavern);
}

/** Castle deck: fixed order, suits shuffled within each rank tier */
export function buildCastleDeck(): number[] {
  // Group by rank: Jacks, Queens, Kings — shuffle within each group
  const jacks = shuffle([11, 24, 37, 50]);
  const queens = shuffle([12, 25, 38, 51]);
  const kings = shuffle([13, 26, 39, 52]);
  return [...jacks, ...queens, ...kings];
}
