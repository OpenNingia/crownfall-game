import { Schema, type, ArraySchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") name: string = "";
  @type("uint8") handCount: number = 0;
  @type("uint8") shields: number = 0;
  @type("boolean") isCurrentTurn: boolean = false;
  @type("boolean") connected: boolean = true;
  @type("boolean") ready: boolean = false;

  // Hand is NOT in the schema — sent privately per-client via client.send("handUpdate")
  // handCount is always visible to everyone for opponent UI
  hand: number[] = []; // server-only field, never serialised
}
