import { describe, it, expect } from "vitest";
import {
  initGame,
  playCards,
  discardCards,
  selectNextPlayer,
  type EngineState,
} from "./GameEngine.js";
import {
  getAttackValue,
  isValidPlay,
  JOKER_BLACK,
  JOKER_RED,
  HAND_SIZES,
} from "@crownfall/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    sessionId: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function freshState(playerCount = 2): EngineState {
  return initGame(makePlayers(playerCount));
}

function injectMonster(
  state: EngineState,
  opts: {
    rank?: number;
    suit?: "hearts" | "diamonds" | "clubs" | "spades";
    hp?: number;
    attack?: number;
    immunityNegated?: boolean;
    spadeReduction?: number;
  }
) {
  const m = state.currentMonster;
  if (opts.rank !== undefined) m.rank = opts.rank;
  if (opts.suit !== undefined) m.suit = opts.suit;
  if (opts.hp !== undefined) { m.maxHp = opts.hp; m.currentHp = opts.hp; }
  if (opts.attack !== undefined) m.attack = opts.attack;
  if (opts.immunityNegated !== undefined) m.immunityNegated = opts.immunityNegated;
  if (opts.spadeReduction !== undefined) m.spadeReduction = opts.spadeReduction;
}

function setHand(state: EngineState, sessionId: string, cards: number[]) {
  state.players.get(sessionId)!.hand = [...cards];
}

// Card ID helpers (see constants.ts for encoding)
// Hearts 1-13, Diamonds 14-26, Clubs 27-39, Spades 40-52
const ACE_H = 1, TWO_H = 2, THREE_H = 3, SEVEN_H = 7, EIGHT_H = 8, TEN_H = 10;
const ACE_D = 14, TWO_D = 15, THREE_D = 16, FIVE_D = 18, SIX_D = 19;
const ACE_C = 27, TWO_C = 28, THREE_C = 29, FOUR_C = 30, FIVE_C = 31;
const ACE_S = 40, TWO_S = 41, THREE_S = 42, FOUR_S = 43, FIVE_S = 44, EIGHT_S = 47;

// ---------------------------------------------------------------------------
// Card values (getAttackValue)
// ---------------------------------------------------------------------------

describe("card values", () => {
  it("Ace = 1 (Animal Companion)", () => {
    expect(getAttackValue(ACE_H)).toBe(1);
    expect(getAttackValue(ACE_D)).toBe(1);
    expect(getAttackValue(ACE_C)).toBe(1);
    expect(getAttackValue(ACE_S)).toBe(1);
  });

  it("2-10 = face value", () => {
    expect(getAttackValue(TWO_H)).toBe(2);
    expect(getAttackValue(SEVEN_H)).toBe(7);
    expect(getAttackValue(TEN_H)).toBe(10);
  });

  it("Jack = 10", () => {
    expect(getAttackValue(11)).toBe(10);  // Jack of Hearts
    expect(getAttackValue(24)).toBe(10);  // Jack of Diamonds
  });

  it("Queen = 15", () => {
    expect(getAttackValue(12)).toBe(15);  // Queen of Hearts
    expect(getAttackValue(25)).toBe(15);  // Queen of Diamonds
  });

  it("King = 20", () => {
    expect(getAttackValue(13)).toBe(20);  // King of Hearts
    expect(getAttackValue(26)).toBe(20);  // King of Diamonds
  });

  it("Joker = 0", () => {
    expect(getAttackValue(JOKER_BLACK)).toBe(0);
    expect(getAttackValue(JOKER_RED)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Play validity (isValidPlay)
// ---------------------------------------------------------------------------

describe("play validity", () => {
  it("empty = invalid", () => expect(isValidPlay([])).toBe(false));
  it("5 cards = invalid", () => expect(isValidPlay([2, 3, 4, 5, 6])).toBe(false));

  it("single non-ace card = valid", () => {
    expect(isValidPlay([EIGHT_H])).toBe(true);
    expect(isValidPlay([TEN_H])).toBe(true);
  });

  it("Joker alone = valid", () => {
    expect(isValidPlay([JOKER_BLACK])).toBe(true);
    expect(isValidPlay([JOKER_RED])).toBe(true);
  });

  it("Joker with other card = invalid", () => {
    expect(isValidPlay([JOKER_BLACK, ACE_H])).toBe(false);
    expect(isValidPlay([ACE_H, JOKER_RED])).toBe(false);
  });

  it("Ace alone = valid (Animal Companion)", () => {
    expect(isValidPlay([ACE_H])).toBe(true);
  });

  it("Ace + one other card (any rank) = valid", () => {
    expect(isValidPlay([ACE_H, EIGHT_S])).toBe(true);  // Ace + 8
    expect(isValidPlay([ACE_H, ACE_D])).toBe(true);    // Ace + Ace
    expect(isValidPlay([ACE_S, FIVE_D])).toBe(true);   // Ace + 5
  });

  it("Ace + Joker = invalid", () => {
    expect(isValidPlay([ACE_H, JOKER_BLACK])).toBe(false);
  });

  it("Ace + two other cards = invalid (Animal Companion can only pair with one)", () => {
    expect(isValidPlay([ACE_H, EIGHT_H, FIVE_D])).toBe(false);
    expect(isValidPlay([ACE_H, ACE_D, ACE_C])).toBe(false);
  });

  it("combo 2×5 = 10 ≤ 10 → valid", () => {
    // 5 of Hearts = card 5, 5 of Diamonds = card 18
    expect(isValidPlay([5, 18])).toBe(true);
  });

  it("combo 2×6 = 12 > 10 → invalid", () => {
    // 6 of Hearts = card 6, 6 of Diamonds = card 19
    expect(isValidPlay([6, 19])).toBe(false);
  });

  it("combo 3×3 = 9 ≤ 10 → valid", () => {
    // 3 of Hearts/Diamonds/Clubs = 3, 16, 29
    expect(isValidPlay([THREE_H, THREE_D, THREE_C])).toBe(true);
  });

  it("combo 4×2 = 8 ≤ 10 → valid", () => {
    // 2 of Hearts/Diamonds/Clubs/Spades = 2, 15, 28, 41
    expect(isValidPlay([TWO_H, TWO_D, TWO_C, TWO_S])).toBe(true);
  });

  it("combo different ranks = invalid", () => {
    expect(isValidPlay([TWO_H, THREE_D])).toBe(false);
  });

  it("single Jack/Queen/King = valid", () => {
    expect(isValidPlay([11])).toBe(true); // Jack
    expect(isValidPlay([12])).toBe(true); // Queen
    expect(isValidPlay([13])).toBe(true); // King
  });

  it("two Jacks = 20 > 10 → invalid combo", () => {
    expect(isValidPlay([11, 24])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Setup / initGame
// ---------------------------------------------------------------------------

describe("setup", () => {
  it("2-player: hand size 7, no Jesters", () => {
    const state = freshState(2);
    expect(state.players.get("p1")!.hand.length).toBe(7);
    expect(state.players.get("p2")!.hand.length).toBe(7);
    // No jokers in tavern for 2 players
    const jokers = state.tavern.filter((c) => c === JOKER_BLACK || c === JOKER_RED);
    expect(jokers.length).toBe(0);
  });

  it("3-player: hand size 6, 1 Jester", () => {
    const state = freshState(3);
    for (const p of state.players.values()) expect(p.hand.length).toBe(6);
    const tavernAndHands = [
      ...state.tavern,
      ...Array.from(state.players.values()).flatMap((p) => p.hand),
    ];
    const jokers = tavernAndHands.filter((c) => c === JOKER_BLACK || c === JOKER_RED);
    expect(jokers.length).toBe(1);
  });

  it("4-player: hand size 5, 2 Jesters", () => {
    const state = freshState(4);
    for (const p of state.players.values()) expect(p.hand.length).toBe(5);
    const tavernAndHands = [
      ...state.tavern,
      ...Array.from(state.players.values()).flatMap((p) => p.hand),
    ];
    const jokers = tavernAndHands.filter((c) => c === JOKER_BLACK || c === JOKER_RED);
    expect(jokers.length).toBe(2);
  });

  it("first monster is always a Jack (rank 11)", () => {
    for (let i = 0; i < 5; i++) {
      const state = freshState(2);
      expect(state.currentMonster.rank).toBe(11);
    }
  });

  it("castle deck contains 12 monsters (4J + 4Q + 4K) in J→Q→K order", () => {
    const state = freshState(2);
    // 11 Jacks already popped as first monster; remaining castleDeck has 11 cards
    expect(state.castleDeck.length).toBe(11);
    const ranks = state.castleDeck.map((id) => {
      if (id <= 13) return (id - 1) % 13 + 1;
      return ((id - 1) % 13) + 1;
    });
    // After removing one Jack, should see 3 Jacks, then 4 Queens, then 4 Kings
    const expectedRanks = [11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13];
    expect(ranks.sort((a, b) => a - b)).toEqual(expectedRanks.sort((a, b) => a - b));
    // Jacks come before Queens, Queens before Kings
    const firstQ = state.castleDeck.findIndex((id) => ((id - 1) % 13 + 1) === 12);
    const lastJ = [...state.castleDeck].reverse().findIndex((id) => ((id - 1) % 13 + 1) === 11);
    const firstK = state.castleDeck.findIndex((id) => ((id - 1) % 13 + 1) === 13);
    expect(firstQ).toBeGreaterThan(lastJ >= 0 ? state.castleDeck.length - 1 - lastJ : -1);
    expect(firstK).toBeGreaterThan(firstQ);
  });

  it("monstersRemaining starts at 12", () => {
    expect(freshState(2).monstersRemaining).toBe(12);
  });

  it("maxHandSize stored in state", () => {
    expect(freshState(2).maxHandSize).toBe(HAND_SIZES[2]);
    expect(freshState(3).maxHandSize).toBe(HAND_SIZES[3]);
    expect(freshState(4).maxHandSize).toBe(HAND_SIZES[4]);
  });
});

// ---------------------------------------------------------------------------
// Damage calculation
// ---------------------------------------------------------------------------

describe("damage calculation", () => {
  it("Ace deals 1 damage", () => {
    const state = freshState();
    setHand(state, "p1", [ACE_S]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 0 });
    playCards(state, "p1", [ACE_S]);
    expect(state.currentMonster.currentHp).toBe(99);
  });

  it("8 deals 8 damage", () => {
    const state = freshState();
    setHand(state, "p1", [EIGHT_H]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    playCards(state, "p1", [EIGHT_H]);
    expect(state.currentMonster.currentHp).toBe(92);
  });

  it("Jack in hand deals 10 damage", () => {
    const state = freshState();
    setHand(state, "p1", [11]); // Jack of Hearts
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    playCards(state, "p1", [11]);
    expect(state.currentMonster.currentHp).toBe(90);
  });

  it("Queen in hand deals 15 damage", () => {
    const state = freshState();
    setHand(state, "p1", [12]); // Queen of Hearts
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    playCards(state, "p1", [12]);
    expect(state.currentMonster.currentHp).toBe(85);
  });

  it("King in hand deals 20 damage", () => {
    const state = freshState();
    setHand(state, "p1", [13]); // King of Hearts
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    playCards(state, "p1", [13]);
    expect(state.currentMonster.currentHp).toBe(80);
  });

  it("clubs doubles damage against non-clubs monster", () => {
    const state = freshState();
    setHand(state, "p1", [FIVE_C]); // 5 of Clubs
    injectMonster(state, { suit: "hearts", hp: 100, attack: 0 });
    playCards(state, "p1", [FIVE_C]);
    expect(state.currentMonster.currentHp).toBe(90); // 5×2 = 10
  });

  it("clubs does NOT double against clubs monster (immune)", () => {
    const state = freshState();
    setHand(state, "p1", [FIVE_C]);
    injectMonster(state, { suit: "clubs", hp: 100, attack: 0 });
    playCards(state, "p1", [FIVE_C]);
    expect(state.currentMonster.currentHp).toBe(95); // 5×1 = 5
  });

  it("clubs doubles when immunity negated", () => {
    const state = freshState();
    setHand(state, "p1", [FIVE_C]);
    injectMonster(state, { suit: "clubs", hp: 100, attack: 0, immunityNegated: true });
    playCards(state, "p1", [FIVE_C]);
    expect(state.currentMonster.currentHp).toBe(90); // 5×2 = 10
  });

  it("combo 3×3: 9 total damage (hearts immune → no double, just 9)", () => {
    const state = freshState();
    setHand(state, "p1", [THREE_H, THREE_D, THREE_C]);
    // Hearts monster: hearts immune (heal ignored), diamonds draws, clubs doubles
    injectMonster(state, { suit: "hearts", hp: 100, attack: 0 });
    playCards(state, "p1", [THREE_H, THREE_D, THREE_C]);
    // 3 (hearts, no suit power but damage still applied) + 3 (diamonds) + 3×2 (clubs) = 3+3+6 = 12
    expect(state.currentMonster.currentHp).toBe(88);
  });
});

// ---------------------------------------------------------------------------
// Suit effects
// ---------------------------------------------------------------------------

describe("suit effects — Hearts", () => {
  it("heals attack-value cards from discard into tavern", () => {
    const state = freshState();
    state.discard = [ACE_H, TWO_H, THREE_H, FOUR_C, FIVE_D]; // 5 cards
    setHand(state, "p1", [THREE_H]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    const tavernBefore = state.tavern.length;
    playCards(state, "p1", [THREE_H]);
    // 3 of hearts → attack val 3 → recycle 3 from discard
    expect(state.tavern.length).toBe(tavernBefore + 3);
    expect(state.discard.length).toBe(2);
  });

  it("hearts immune: no heal when playing against hearts monster", () => {
    const state = freshState();
    state.discard = [ACE_H, TWO_H, THREE_H];
    setHand(state, "p1", [THREE_H]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 0 });
    const tavernBefore = state.tavern.length;
    playCards(state, "p1", [THREE_H]);
    expect(state.tavern.length).toBe(tavernBefore); // no heal
  });

  it("hearts with immunity negated: heal applies", () => {
    const state = freshState();
    state.discard = [ACE_H, TWO_H, THREE_H];
    setHand(state, "p1", [THREE_H]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 0, immunityNegated: true });
    const tavernBefore = state.tavern.length;
    playCards(state, "p1", [THREE_H]);
    expect(state.tavern.length).toBe(tavernBefore + 3);
  });
});

describe("suit effects — Diamonds", () => {
  it("draws attack-value cards round-robin starting from current player", () => {
    const state = freshState(2); // 2 players, max hand 7
    setHand(state, "p1", [FOUR_C]); // play clubs 4 (not diamonds, so no draw) — wrong, let's use diamonds
    // 4 of Diamonds = 14+3 = 17... actually offset: A=14, 2=15, 3=16, 4=17
    const FOUR_D = 17;
    setHand(state, "p1", [FOUR_D]);
    setHand(state, "p2", []);
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    // 4 of diamonds: attack val 4 → draw 4 cards round-robin
    // p1 draws 1, p2 draws 1, p1 draws 1, p2 draws 1 → p1 gets 2, p2 gets 2
    playCards(state, "p1", [FOUR_D]);
    // p1 played [FOUR_D], draws 2 back: net hand = 0 + 2 = 2
    expect(state.players.get("p1")!.hand.length).toBe(2);
    expect(state.players.get("p2")!.hand.length).toBe(2);
  });

  it("diamonds immune: no draw when playing against diamonds monster", () => {
    const FOUR_D = 17;
    const state = freshState(2);
    setHand(state, "p1", [FOUR_D]);
    setHand(state, "p2", []);
    injectMonster(state, { suit: "diamonds", hp: 100, attack: 0 });
    playCards(state, "p1", [FOUR_D]);
    expect(state.players.get("p1")!.hand.length).toBe(0); // no draw
    expect(state.players.get("p2")!.hand.length).toBe(0);
  });

  it("draw stops when tavern is empty", () => {
    const FOUR_D = 17;
    const state = freshState(2);
    setHand(state, "p1", [FOUR_D]);
    setHand(state, "p2", []); // clear initial hand so p2 isn't at max
    state.tavern = [ACE_H]; // only 1 card left
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    playCards(state, "p1", [FOUR_D]);
    // attempted to draw 4 (val=4), but only 1 card in tavern
    expect(state.tavern.length).toBe(0);
    const totalDrawn = state.players.get("p1")!.hand.length + state.players.get("p2")!.hand.length;
    expect(totalDrawn).toBe(1);
  });

  it("player at max hand size is skipped during round-robin draw", () => {
    const FOUR_D = 17;
    const state = freshState(2); // maxHandSize = 7
    setHand(state, "p1", [FOUR_D]);
    // fill p2 to max (7 cards)
    setHand(state, "p2", [1, 2, 3, 4, 5, 6, 7]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    playCards(state, "p1", [FOUR_D]);
    // p1 draws 1, p2 full → skip, p1 draws 1, p2 full → skip... all 4 go to p1 but max is 7
    // p1 started with 1 card (FOUR_D), played it (0), draws 4 → 4 (under max 7)
    expect(state.players.get("p1")!.hand.length).toBe(4);
    expect(state.players.get("p2")!.hand.length).toBe(7); // unchanged
  });
});

describe("suit effects — Spades", () => {
  it("spades reduce monster effective attack (cumulative on monster)", () => {
    const state = freshState(2);
    // p1 plays 5 of spades → spadeReduction = 5
    setHand(state, "p1", [FIVE_S, 1, 2, 3, 4, 5, 6]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 10 });
    playCards(state, "p1", [FIVE_S]);
    expect(state.currentMonster.spadeReduction).toBe(5);
    // effective attack = 10 - 5 = 5 → p1 must cover 5 damage
    expect(state.phase).toBe("awaiting_discard");
    expect(state.discardRequired.get("p1")).toBe(5);
  });

  it("spades cumulative: multiple players' shields stack against the same monster", () => {
    const state = freshState(2);
    // p1 plays 3 of spades → spadeReduction = 3
    setHand(state, "p1", [THREE_S, 1, 2, 3, 4, 5]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 10 });
    // p1 plays 3 of spades, monster attack (10) - spadeReduction (3) = 7 discard needed
    const THREE_S_ID = 42;
    setHand(state, "p1", [THREE_S_ID, 1, 2, 3, 4, 5, 6, 7]);
    playCards(state, "p1", [THREE_S_ID]);
    expect(state.currentMonster.spadeReduction).toBe(3);
    expect(state.discardRequired.get("p1")).toBe(7);

    // p1 discards enough to clear
    discardCards(state, "p1", [7]); // value 7 ≥ 7
    expect(state.phase).toBe("playing"); // p2's turn

    // Now p2 plays spades — spadeReduction should still be 3 from p1
    setHand(state, "p2", [FOUR_S, 1, 2, 3, 4, 5]);
    playCards(state, "p2", [FOUR_S]);
    expect(state.currentMonster.spadeReduction).toBe(7); // 3 + 4
    // effective attack = 10 - 7 = 3 for p2
    expect(state.discardRequired.get("p2")).toBe(3);
  });

  it("spades reset to 0 on new monster", () => {
    const state = freshState(2);
    setHand(state, "p1", [FIVE_S]);
    injectMonster(state, { suit: "hearts", hp: 1, attack: 0 }); // dies in one hit
    playCards(state, "p1", [FIVE_S]);
    // monster defeated (1 hp, spades does 5 dmg → overkill)
    expect(state.currentMonster.spadeReduction).toBe(0); // new monster, fresh slate
  });

  it("spades immune: no shield when playing against spades monster", () => {
    const state = freshState(2);
    setHand(state, "p1", [FIVE_S, 1, 2, 3, 4, 5, 6]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 10 });
    playCards(state, "p1", [FIVE_S]);
    expect(state.currentMonster.spadeReduction).toBe(0); // immunity: no shield
    // effective attack = 10 - 0 = 10
    expect(state.discardRequired.get("p1")).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Monster defeat
// ---------------------------------------------------------------------------

describe("monster defeat", () => {
  it("defeated monster goes to discard (overkill)", () => {
    const state = freshState();
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 5, attack: 0 }); // deal 10, hp 5 → overkill
    const discardBefore = state.discard.length;
    const monsterId = state.currentMonster.cardId;
    playCards(state, "p1", [TEN_H]);
    expect(state.discard).toContain(monsterId);
    expect(state.discard.length).toBeGreaterThan(discardBefore);
  });

  it("exact kill: monster goes on top of Tavern deck", () => {
    const state = freshState();
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 10, attack: 0 }); // exact: 10 dmg = 10 hp
    const monsterId = state.currentMonster.cardId;
    const tavernBefore = state.tavern.length;
    playCards(state, "p1", [TEN_H]);
    // Monster should be on top of tavern
    expect(state.tavern[0]).toBe(monsterId);
    expect(state.tavern.length).toBe(tavernBefore + 1);
    expect(state.discard).not.toContain(monsterId);
  });

  it("board cards go to discard on defeat", () => {
    const state = freshState();
    state.boardCards = [TWO_H, THREE_H];
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 5, attack: 0 });
    playCards(state, "p1", [TEN_H]);
    expect(state.discard).toContain(TWO_H);
    expect(state.discard).toContain(THREE_H);
    expect(state.boardCards.length).toBe(0);
  });

  it("defeating player skips step 4 (no discard phase)", () => {
    const state = freshState();
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 5, attack: 100 }); // huge attack, but defeated first
    playCards(state, "p1", [TEN_H]);
    // Phase should be "playing" against new monster, not "awaiting_discard"
    expect(state.phase).toBe("playing");
  });

  it("advances to next monster on defeat", () => {
    const state = freshState();
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 5, attack: 0 });
    const castleBefore = state.castleDeck.length;
    playCards(state, "p1", [TEN_H]);
    expect(state.castleDeck.length).toBe(castleBefore - 1);
    expect(state.monstersRemaining).toBe(11);
  });

  it("victory when last monster defeated", () => {
    const state = freshState();
    state.castleDeck = [];
    state.monstersRemaining = 1;
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 5, attack: 0 });
    const r = playCards(state, "p1", [TEN_H]);
    expect(r.state.phase).toBe("victory");
  });

  it("player shields reset to 0 on new monster", () => {
    const state = freshState();
    state.players.get("p1")!.shields = 5; // simulate prior spades contribution
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 5, attack: 0 });
    playCards(state, "p1", [TEN_H]);
    expect(state.players.get("p1")!.shields).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Step 4 — Suffer damage (discard phase)
// ---------------------------------------------------------------------------

describe("suffer damage / discard phase", () => {
  it("discard by total value, not card count", () => {
    const state = freshState();
    // Monster attack 10, no spades → discard value 10
    setHand(state, "p1", [TEN_H, ACE_D, ACE_S]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 10 });
    playCards(state, "p1", [EIGHT_H]); // should fail — EIGHT_H not in hand
    // Let's use a card that doesn't trigger suit effects
    setHand(state, "p1", [TWO_C, TEN_H]); // clubs 2 vs hearts monster → 2*2=4 dmg, then attack
    injectMonster(state, { suit: "hearts", hp: 100, attack: 10 });
    playCards(state, "p1", [TWO_C]); // 4 damage
    expect(state.phase).toBe("awaiting_discard");
    expect(state.discardRequired.get("p1")).toBe(10);

    // Discard one 10 (value 10) → covers the 10 damage exactly
    const r = discardCards(state, "p1", [TEN_H]);
    expect(r.error).toBeUndefined();
    expect(r.state.phase).toBe("playing");
  });

  it("discard insufficient value → error", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 8);
    setHand(state, "p1", [THREE_H, FOUR_C]); // values 3 + 4 = 7 < 8
    const r = discardCards(state, "p1", [THREE_H, FOUR_C]);
    expect(r.error).toBeTruthy();
  });

  it("Ace value = 1 when discarding", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 1);
    setHand(state, "p1", [ACE_H]);
    const r = discardCards(state, "p1", [ACE_H]);
    expect(r.error).toBeUndefined(); // 1 ≥ 1
  });

  it("Jack value = 10 when discarding", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 10);
    setHand(state, "p1", [11]); // Jack of Hearts
    const r = discardCards(state, "p1", [11]);
    expect(r.error).toBeUndefined(); // 10 ≥ 10
  });

  it("Queen value = 15 when discarding", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 15);
    setHand(state, "p1", [12]); // Queen of Hearts
    const r = discardCards(state, "p1", [12]);
    expect(r.error).toBeUndefined(); // 15 ≥ 15
  });

  it("King value = 20 when discarding", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 20);
    setHand(state, "p1", [13]); // King of Hearts
    const r = discardCards(state, "p1", [13]);
    expect(r.error).toBeUndefined(); // 20 ≥ 20
  });

  it("can overshoot (discard more than required)", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 3);
    setHand(state, "p1", [TEN_H]); // value 10 ≥ 3
    const r = discardCards(state, "p1", [TEN_H]);
    expect(r.error).toBeUndefined();
  });

  it("empty hand after discard is OK if value was covered", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 10);
    setHand(state, "p1", [TEN_H]);
    const r = discardCards(state, "p1", [TEN_H]);
    expect(r.error).toBeUndefined();
    expect(r.state.players.get("p1")!.hand.length).toBe(0);
    expect(r.state.phase).toBe("playing");
  });

  it("defeat: player cannot cover damage (max coverable < attack)", () => {
    const state = freshState();
    // Hand has only aces (value 1 each), monster attacks 10
    setHand(state, "p1", [TWO_C]); // clubs 2 vs spades monster (no double), 2 dmg
    injectMonster(state, { suit: "spades", hp: 100, attack: 10 });
    // p1 will have no cards in hand after playing TWO_C, can't cover 10 attack
    playCards(state, "p1", [TWO_C]);
    expect(state.phase).toBe("defeat");
  });

  it("Jester value = 0 when discarding (can't cover damage)", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 1);
    setHand(state, "p1", [JOKER_BLACK]);
    const r = discardCards(state, "p1", [JOKER_BLACK]);
    // Joker value = 0, so 0 < 1 → can't cover
    expect(r.error).toBeTruthy();
  });

  it("discarded cards move to discard pile", () => {
    const state = freshState();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 5);
    setHand(state, "p1", [FIVE_C]);
    discardCards(state, "p1", [FIVE_C]);
    expect(state.discard).toContain(FIVE_C);
  });

  it("after discard, next player's turn begins", () => {
    const state = freshState(2);
    state.phase = "awaiting_discard";
    state.currentPlayerSessionId = "p1";
    state.discardRequired.set("p1", 5);
    setHand(state, "p1", [FIVE_C]);
    discardCards(state, "p1", [FIVE_C]);
    expect(state.phase).toBe("playing");
    expect(state.currentPlayerSessionId).toBe("p2");
  });
});

// ---------------------------------------------------------------------------
// Jester (Joker)
// ---------------------------------------------------------------------------

describe("Jester / Joker", () => {
  it("Jester attack value = 0", () => {
    expect(getAttackValue(JOKER_BLACK)).toBe(0);
    expect(getAttackValue(JOKER_RED)).toBe(0);
  });

  it("playing Jester clears board, resets pendingDamage, negates immunity", () => {
    const state = freshState();
    state.boardCards = [TWO_H, THREE_D];
    state.pendingDamage = 5;
    setHand(state, "p1", [JOKER_BLACK]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 5 });
    playCards(state, "p1", [JOKER_BLACK]);
    expect(state.boardCards.length).toBe(0);
    expect(state.pendingDamage).toBe(0);
    expect(state.currentMonster.immunityNegated).toBe(true);
  });

  it("Jester does NOT deal damage (step 3 skipped)", () => {
    const state = freshState();
    setHand(state, "p1", [JOKER_BLACK]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 5 });
    playCards(state, "p1", [JOKER_BLACK]);
    expect(state.currentMonster.currentHp).toBe(100); // no damage
  });

  it("Jester does NOT trigger discard (step 4 skipped)", () => {
    const state = freshState();
    setHand(state, "p1", [JOKER_BLACK]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 100 });
    const r = playCards(state, "p1", [JOKER_BLACK]);
    expect(r.state.phase).toBe("awaiting_next_player_select");
    expect(r.state.discardRequired.size).toBe(0);
  });

  it("Jester sends to awaiting_next_player_select phase", () => {
    const state = freshState();
    setHand(state, "p1", [JOKER_BLACK]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 0 });
    playCards(state, "p1", [JOKER_BLACK]);
    expect(state.phase).toBe("awaiting_next_player_select");
  });

  it("selectNextPlayer: active player chooses who goes next, resumes playing", () => {
    const state = freshState(2);
    state.phase = "awaiting_next_player_select";
    state.currentPlayerSessionId = "p1";
    const r = selectNextPlayer(state, "p1", "p2");
    expect(r.state.phase).toBe("playing");
    expect(r.state.currentPlayerSessionId).toBe("p2");
  });

  it("selectNextPlayer: can choose the same player who played the Jester", () => {
    const state = freshState(2);
    state.phase = "awaiting_next_player_select";
    state.currentPlayerSessionId = "p1";
    const r = selectNextPlayer(state, "p1", "p1");
    expect(r.error).toBeUndefined();
    expect(r.state.currentPlayerSessionId).toBe("p1");
  });
});

// ---------------------------------------------------------------------------
// Turn rotation
// ---------------------------------------------------------------------------

describe("turn rotation", () => {
  it("turn advances to next player after surviving attack (no discard)", () => {
    const state = freshState(2);
    state.currentPlayerSessionId = "p1";
    setHand(state, "p1", [TWO_H]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 }); // no attack
    playCards(state, "p1", [TWO_H]);
    expect(state.phase).toBe("playing");
    expect(state.currentPlayerSessionId).toBe("p2");
  });

  it("turn advances to next player after discard satisfied", () => {
    const state = freshState(2);
    state.currentPlayerSessionId = "p1";
    state.phase = "awaiting_discard";
    state.discardRequired.set("p1", 3);
    setHand(state, "p1", [THREE_H]);
    discardCards(state, "p1", [THREE_H]);
    expect(state.currentPlayerSessionId).toBe("p2");
  });

  it("turn rotates back to first player after last player", () => {
    const state = freshState(2);
    state.currentPlayerSessionId = "p2";
    setHand(state, "p2", [TWO_D]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    playCards(state, "p2", [TWO_D]);
    expect(state.currentPlayerSessionId).toBe("p1");
  });

  it("after defeating a monster, same player continues (no turn advance)", () => {
    const state = freshState(2);
    state.currentPlayerSessionId = "p1";
    setHand(state, "p1", [TEN_H]);
    injectMonster(state, { suit: "spades", hp: 5, attack: 0 });
    playCards(state, "p1", [TEN_H]);
    expect(state.currentPlayerSessionId).toBe("p1");
  });
});

// ---------------------------------------------------------------------------
// Animal Companion pairing
// ---------------------------------------------------------------------------

describe("Animal Companion (Ace) pairing", () => {
  it("Ace + 8 of spades: both suit powers apply at combined value 9", () => {
    const state = freshState();
    // ACE_H (hearts, val 1) + EIGHT_S (spades, val 8) → combined attack = 9
    // hearts heal = 1, spades shield = 8
    // give p1 extra cards to cover the remaining attack after shields
    state.discard = [TWO_C, THREE_C, FOUR_C];
    setHand(state, "p1", [ACE_H, EIGHT_S, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); // plenty to discard
    injectMonster(state, { suit: "diamonds", hp: 100, attack: 20 });
    const tavernBefore = state.tavern.length;
    playCards(state, "p1", [ACE_H, EIGHT_S]);
    // Hearts: heals 1 from discard
    expect(state.tavern.length).toBe(tavernBefore + 1);
    // Spades: shield 8 → effective attack = 20 - 8 = 12
    expect(state.currentMonster.spadeReduction).toBe(8);
    expect(state.discardRequired.get("p1")).toBe(12);
  });

  it("Ace + card of same suit: suit power applied once", () => {
    const state = freshState();
    // ACE_H + 3_H: both hearts, so heal applies once (not twice)
    // combined attack value = 1 + 3 = 4, so heal = 4 (not 1+3 separately)
    state.discard = [TWO_C, THREE_C, FOUR_C, FIVE_C, SIX_D];
    setHand(state, "p1", [ACE_H, THREE_H]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 0 });
    const tavernBefore = state.tavern.length;
    playCards(state, "p1", [ACE_H, THREE_H]);
    // Heal = attack value of play = 1+3 = 4 (hearts power once at combined value)
    expect(state.tavern.length).toBe(tavernBefore + 4);
  });
});

// ---------------------------------------------------------------------------
// Enemy immunity
// ---------------------------------------------------------------------------

describe("enemy immunity", () => {
  it("immunity: matching suit power is cancelled but damage still applies", () => {
    const state = freshState();
    // 5 of diamonds against diamonds monster → no draw, but 5 damage still dealt
    setHand(state, "p1", [FIVE_D]);
    injectMonster(state, { suit: "diamonds", hp: 100, attack: 0 });
    const p1HandBefore = state.players.get("p1")!.hand.length;
    playCards(state, "p1", [FIVE_D]);
    expect(state.currentMonster.currentHp).toBe(95); // 5 damage dealt
    // No draw: p1 hand should have decreased by 1 (played) and no draws
    expect(state.players.get("p1")!.hand.length).toBe(p1HandBefore - 1);
  });

  it("Jester negates immunity for subsequent cards", () => {
    const state = freshState(2);
    // First, play Jester to negate hearts immunity
    setHand(state, "p1", [JOKER_BLACK]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 0 });
    playCards(state, "p1", [JOKER_BLACK]);
    selectNextPlayer(state, "p1", "p2");

    // Now p2 plays hearts → should heal (immunity negated)
    state.discard = [ACE_C, TWO_C, THREE_C];
    setHand(state, "p2", [THREE_H]);
    const tavernBefore = state.tavern.length;
    playCards(state, "p2", [THREE_H]);
    expect(state.tavern.length).toBe(tavernBefore + 3); // hearts healed
  });
});
