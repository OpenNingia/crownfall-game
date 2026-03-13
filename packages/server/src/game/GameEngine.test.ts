import { describe, it, expect, beforeEach } from "vitest";
import {
  initGame,
  playCards,
  discardCards,
  selectNextPlayer,
  type EngineState,
} from "./GameEngine.js";
import { JOKER_BLACK, JOKER_RED } from "@crownfall/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    sessionId: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function stateWith2Players(): EngineState {
  // Seed deterministic state
  return initGame(makePlayers(2));
}

// Override the first monster and inject known cards for deterministic tests
function injectMonster(
  state: EngineState,
  opts: {
    rank?: number;
    suit?: "hearts" | "diamonds" | "clubs" | "spades";
    hp?: number;
    attack?: number;
    immunityNegated?: boolean;
  }
) {
  const m = state.currentMonster;
  if (opts.rank !== undefined) m.rank = opts.rank;
  if (opts.suit !== undefined) m.suit = opts.suit;
  if (opts.hp !== undefined) {
    m.maxHp = opts.hp;
    m.currentHp = opts.hp;
  }
  if (opts.attack !== undefined) m.attack = opts.attack;
  if (opts.immunityNegated !== undefined) m.immunityNegated = opts.immunityNegated;
}

/** Give player specific cards, ignoring current hand */
function injectHand(state: EngineState, sessionId: string, cards: number[]) {
  const p = state.players.get(sessionId)!;
  p.hand = [...cards];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("initGame", () => {
  it("creates correct player count and hands", () => {
    const state = initGame(makePlayers(2));
    expect(state.players.size).toBe(2);
    expect(state.players.get("p1")!.hand.length).toBe(7);
    expect(state.players.get("p2")!.hand.length).toBe(7);
    expect(state.phase).toBe("playing");
  });

  it("distributes 3-player hands correctly", () => {
    const state = initGame(makePlayers(3));
    for (const p of state.players.values()) {
      expect(p.hand.length).toBe(6);
    }
  });

  it("sets first monster", () => {
    const state = initGame(makePlayers(2));
    expect([11, 12, 13].includes(state.currentMonster.rank)).toBe(true);
  });

  it("monstersRemaining starts at 12", () => {
    const state = initGame(makePlayers(2));
    expect(state.monstersRemaining).toBe(12);
  });
});

describe("isValidPlay", () => {
  it("rejects empty play", () => {
    const state = stateWith2Players();
    injectHand(state, "p1", [1, 2, 3]);
    injectMonster(state, { hp: 100, attack: 5 });
    const r = playCards(state, "p1", []);
    expect(r.error).toBeTruthy();
  });

  it("rejects joker with other cards", () => {
    const state = stateWith2Players();
    injectHand(state, "p1", [JOKER_BLACK, 1]);
    injectMonster(state, { hp: 100, attack: 5 });
    const r = playCards(state, "p1", [JOKER_BLACK, 1]);
    expect(r.error).toBeTruthy();
  });

  it("allows single joker", () => {
    const state = stateWith2Players();
    injectHand(state, "p1", [JOKER_BLACK]);
    injectMonster(state, { hp: 100, attack: 5 });
    const r = playCards(state, "p1", [JOKER_BLACK]);
    expect(r.error).toBeUndefined();
  });
});

describe("damage calculation", () => {
  it("ace hits for 14", () => {
    const state = stateWith2Players();
    // Ace of spades = 40, monster not spades
    injectHand(state, "p1", [40]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 5 });
    const r = playCards(state, "p1", [40]);
    // 14 damage, monster at 86
    expect(r.state.currentMonster.currentHp).toBe(86);
  });

  it("clubs doubles damage (non-immune)", () => {
    const state = stateWith2Players();
    // 5 of clubs = 32 (rank 6, 32-27=5, offset 26, card 31 is rank 5)
    // clubs offset=26: A=27, 2=28, 3=29, 4=30, 5=31
    injectHand(state, "p1", [31]); // 5 of clubs
    injectMonster(state, { suit: "hearts", hp: 100, attack: 5 });
    const r = playCards(state, "p1", [31]);
    expect(r.state.currentMonster.currentHp).toBe(90); // 100 - 5*2 = 90
  });

  it("clubs does NOT double against clubs monster (immune)", () => {
    const state = stateWith2Players();
    injectHand(state, "p1", [31]); // 5 of clubs
    injectMonster(state, { suit: "clubs", hp: 100, attack: 5 });
    const r = playCards(state, "p1", [31]);
    expect(r.state.currentMonster.currentHp).toBe(95); // 100 - 5*1 = 95
  });

  it("clubs doubles against immune clubs monster when immunity negated", () => {
    const state = stateWith2Players();
    injectHand(state, "p1", [31]); // 5 of clubs
    injectMonster(state, { suit: "clubs", hp: 100, attack: 5, immunityNegated: true });
    const r = playCards(state, "p1", [31]);
    expect(r.state.currentMonster.currentHp).toBe(90); // 100 - 5*2 = 90
  });
});

describe("suit effects", () => {
  it("hearts effect: recycles discard into tavern", () => {
    const state = stateWith2Players();
    // Push some discard
    state.discard = [1, 2, 3, 4, 5];
    // 3 of hearts = card 3
    injectHand(state, "p1", [3]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 5 });
    const before = state.tavern.length;
    playCards(state, "p1", [3]);
    // 3 cards recycled (val=3), tavern grows by min(3, 5)=3
    expect(state.tavern.length).toBe(before + 3);
  });

  it("hearts effect ignored against hearts monster", () => {
    const state = stateWith2Players();
    state.discard = [1, 2, 3];
    injectHand(state, "p1", [3]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 5 });
    const before = state.tavern.length;
    playCards(state, "p1", [3]);
    expect(state.tavern.length).toBe(before); // no heal
  });

  it("diamonds effect: draws cards", () => {
    const state = stateWith2Players();
    // 3 of diamonds = card 16 (offset 13: A=14, 2=15, 3=16)
    injectHand(state, "p1", [16]);
    injectMonster(state, { suit: "spades", hp: 100, attack: 5 });
    const before = state.players.get("p1")!.hand.length;
    playCards(state, "p1", [16]);
    // drew 3 cards (val=3), hand was [16] → play removes it → 0 + 3 = 3
    expect(state.players.get("p1")!.hand.length).toBe(3);
  });

  it("spades effect: grants shields", () => {
    const state = stateWith2Players();
    // 4 of spades = card 43 (offset 39: A=40, 2=41, 3=42, 4=43)
    // Give p1 enough cards to survive: plays 43, needs to discard 6 after (attack 10 - shields 4)
    injectHand(state, "p1", [43, 1, 2, 3, 4, 5, 6]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 10 });
    playCards(state, "p1", [43]);
    // Shields = 4, attack = 10, discard = max(0, 10-4) = 6, hand remaining = 6 → awaiting_discard
    expect(state.phase).toBe("awaiting_discard");
    expect(state.discardRequired.get("p1")).toBe(6);
  });
});

describe("monster defeat", () => {
  it("advances to next monster on defeat", () => {
    const state = stateWith2Players();
    injectHand(state, "p1", [40]); // ace of spades = 14 dmg
    injectMonster(state, { suit: "hearts", hp: 10, attack: 5 });
    const before = state.castleDeck.length;
    const r = playCards(state, "p1", [40]);
    expect(r.events.some((e) => e.type === "monsterDefeated")).toBe(true);
    expect(r.state.castleDeck.length).toBe(before - 1);
  });

  it("triggers victory when all monsters defeated", () => {
    const state = stateWith2Players();
    state.castleDeck = [];
    state.monstersRemaining = 1;
    injectHand(state, "p1", [40]);
    injectMonster(state, { suit: "hearts", hp: 10, attack: 5 });
    const r = playCards(state, "p1", [40]);
    expect(r.state.phase).toBe("victory");
    expect(r.events.some((e) => e.type === "victory")).toBe(true);
  });
});

describe("discard phase", () => {
  it("completes discard and advances turn", () => {
    const state = stateWith2Players();
    // Force discard phase
    state.phase = "awaiting_discard";
    state.discardRequired.set("p2", 2);
    injectHand(state, "p2", [1, 2, 3]);
    const r = discardCards(state, "p2", [1, 2]);
    expect(r.error).toBeUndefined();
    expect(r.state.phase).toBe("playing");
    expect(r.state.discardRequired.size).toBe(0);
  });

  it("rejects wrong number of discarded cards", () => {
    const state = stateWith2Players();
    state.phase = "awaiting_discard";
    state.discardRequired.set("p2", 2);
    injectHand(state, "p2", [1, 2, 3]);
    const r = discardCards(state, "p2", [1]);
    expect(r.error).toBeTruthy();
  });
});

describe("joker", () => {
  it("clears board and enters next-player-select phase", () => {
    const state = stateWith2Players();
    state.boardCards = [1, 2, 3];
    state.pendingDamage = 10;
    injectHand(state, "p1", [JOKER_BLACK]);
    injectMonster(state, { suit: "hearts", hp: 100, attack: 5 });
    const r = playCards(state, "p1", [JOKER_BLACK]);
    expect(r.state.boardCards.length).toBe(0);
    expect(r.state.pendingDamage).toBe(0);
    expect(r.state.phase).toBe("awaiting_next_player_select");
    expect(r.state.currentMonster.immunityNegated).toBe(true);
  });

  it("selectNextPlayer switches current player and resumes playing", () => {
    const state = stateWith2Players();
    state.phase = "awaiting_next_player_select";
    state.currentPlayerSessionId = "p1";
    const r = selectNextPlayer(state, "p1", "p2");
    expect(r.state.phase).toBe("playing");
    expect(r.state.currentPlayerSessionId).toBe("p2");
  });
});

describe("ace pairing", () => {
  it("allows playing 4 aces of different suits as combo", () => {
    const state = stateWith2Players();
    // Ace of Hearts=1, Ace of Diamonds=14, Ace of Clubs=27, Ace of Spades=40
    injectHand(state, "p1", [1, 14, 27, 40]);
    injectMonster(state, { suit: "hearts", hp: 200, attack: 5 });
    const r = playCards(state, "p1", [1, 14, 27, 40]);
    expect(r.error).toBeUndefined();
    // Damage: hearts=14 (immune no), diamonds=14, clubs=14*2=28, spades=14
    // heartHeal = 14, diamondDraw = 14, spadeShield = 14, clubs = 28 dmg
    // total damage = 14+14+28+14 = 70
    expect(r.state.currentMonster.currentHp).toBe(130);
  });
});
