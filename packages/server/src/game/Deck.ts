import { CASTLE_CARD_IDS, JOKER_BLACK, JOKER_RED, JESTER_COUNT } from "@crownfall/shared";
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
 * Returns the Tavern deck for the given player count (shuffled).
 * Includes cards 2–10, Aces, and the correct number of Jesters per player count.
 */
export function buildTavernDeck(playerCount: number): number[] {
  const monsterSet = new Set(CASTLE_CARD_IDS);
  const tavern: number[] = [];

  // Cards 1–52 that are not monsters (includes Aces 1/14/27/40)
  for (let id = 1; id <= 52; id++) {
    if (!monsterSet.has(id)) {
      tavern.push(id);
    }
  }

  const jesters = JESTER_COUNT[playerCount] ?? 0;
  if (jesters >= 1) tavern.push(JOKER_BLACK);
  if (jesters >= 2) tavern.push(JOKER_RED);

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
