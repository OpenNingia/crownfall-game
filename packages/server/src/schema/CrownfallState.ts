import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";
import { MonsterState } from "./MonsterState.js";

export class CrownfallState extends Schema {
  @type("string") phase: string = "lobby";

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  @type(MonsterState) currentMonster = new MonsterState();

  @type(["uint8"]) castleDeck = new ArraySchema<number>();

  @type(["uint8"]) boardCards = new ArraySchema<number>();

  @type("uint16") tavernSize: number = 0;

  @type("uint16") discardSize: number = 0;

  @type("uint16") pendingDamage: number = 0;

  @type("string") currentPlayerSessionId: string = "";

  /** sessionId → number of cards that player must discard */
  @type({ map: "uint8" }) discardRequired = new MapSchema<number>();

  @type("uint8") monstersRemaining: number = 12;

  @type("uint32") turnNumber: number = 0;
}
