import { Schema, type } from "@colyseus/schema";

export class MonsterState extends Schema {
  @type("uint8") cardId: number = 0;
  @type("uint8") rank: number = 0;
  @type("string") suit: string = "";
  @type("uint16") maxHp: number = 0;
  @type("int16") currentHp: number = 0;
  @type("uint8") attack: number = 0;
  @type("boolean") immunityNegated: boolean = false;
  @type("uint16") spadeReduction: number = 0;
}
