import { Room, Client } from "@colyseus/core";
import { CrownfallState } from "../schema/CrownfallState.js";
import { PlayerState } from "../schema/PlayerState.js";
import { MonsterState } from "../schema/MonsterState.js";
import {
  initGame,
  playCards,
  discardCards,
  selectNextPlayer,
  yieldTurn,
  removePlayer,
  useJesterPower,
  type EngineState,
  type EngineMonster,
  type EnginePlayer,
  type PlayEvent,
} from "../game/GameEngine.js";
import { MIN_PLAYERS, MAX_PLAYERS, type GameEvent } from "@crownfall/shared";
import { GameLogger, descCard, descCards } from "../logger.js";

type RoomOpts = { state: CrownfallState };

export class CrownfallRoom extends Room<RoomOpts> {
  private engine: EngineState | null = null;
  private log!: GameLogger;

  onCreate(_options: Record<string, unknown>) {
    this.log = new GameLogger(this.roomId);
    this.setState(new CrownfallState());
    this.maxClients = MAX_PLAYERS;

    this.onMessage("ready", (client) => this.handleReady(client));
    this.onMessage("playCards", (client, payload) => this.handlePlayCards(client, payload));
    this.onMessage("discardCards", (client, payload) => this.handleDiscardCards(client, payload));
    this.onMessage("selectNextPlayer", (client, payload) =>
      this.handleSelectNextPlayer(client, payload)
    );
    this.onMessage("yield", (client) => this.handleYield(client));
    this.onMessage("useJesterPower", (client) => this.handleUseJesterPower(client));
  }

  onJoin(client: Client, options: Record<string, unknown>) {
    if (this.state.phase !== "lobby") return;

    const name = String(options?.name ?? `Player${this.clients.length}`);
    const player = new PlayerState();
    player.name = name;
    player.connected = true;
    this.state.players.set(client.sessionId, player);

    this.log.info(`Player joined — "${name}" (${client.sessionId})`);
  }

  async onLeave(client: Client, code?: number) {
    const CONSENTED_CODE = 4000;
    const consented = code === CONSENTED_CODE;
    const name = this.playerName(client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    if (this.engine) {
      const ep = this.engine.players.get(client.sessionId);
      if (ep) ep.connected = false;
    }

    if (consented) {
      this.log.info(`Player left — "${name}" (${client.sessionId}) [consented]`);
      return;
    }

    this.log.warn(`Player disconnected — "${name}" (${client.sessionId}) — awaiting reconnection (30s)`);

    try {
      await this.allowReconnection(client, 30);
      if (player) player.connected = true;
      if (this.engine) {
        const ep = this.engine.players.get(client.sessionId);
        if (ep) ep.connected = true;
        this.sendHandUpdate(client);
      }
      this.log.info(`Player reconnected — "${name}" (${client.sessionId})`);
    } catch {
      this.state.players.delete(client.sessionId);
      if (this.engine) removePlayer(this.engine, client.sessionId);
      this.log.warn(`Player removed after timeout — "${name}" (${client.sessionId})`);
    }
  }

  onDispose() {
    this.log.close();
  }

  // -------------------------------------------------------------------------
  // Message handlers
  // -------------------------------------------------------------------------

  private handleReady(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== "lobby") return;

    player.ready = !player.ready;
    this.log.info(`Ready toggle — "${player.name}" (${client.sessionId}) → ${player.ready ? "READY" : "NOT READY"}`);

    const connectedPlayers = [...this.state.players.values()].filter((p) => p.connected);
    const allReady = connectedPlayers.every((p) => p.ready);

    if (allReady && connectedPlayers.length >= MIN_PLAYERS) {
      this.startGame();
    }
  }

  private handlePlayCards(client: Client, payload: { cardIds: number[] }) {
    if (!this.engine) return;
    if (!Array.isArray(payload?.cardIds)) return;

    const name = this.playerName(client.sessionId);
    const cardDesc = descCards(payload.cardIds);

    const result = playCards(this.engine, client.sessionId, payload.cardIds);
    if (result.error) {
      this.log.warn(`playCards rejected — "${name}": ${result.error} (cards: ${cardDesc})`);
      client.send("error", { message: result.error });
      return;
    }

    this.log.info(`[${name}] played ${cardDesc} — ${this.formatEvents(result.events)} → ${this.formatEngineSnapshot(result.state)}`);
    this.engine = result.state;
    this.syncStateFromEngine();
    this.broadcastGameEvents(result.events);
  }

  private handleDiscardCards(client: Client, payload: { cardIds: number[] }) {
    if (!this.engine) return;
    if (!Array.isArray(payload?.cardIds)) return;

    const name = this.playerName(client.sessionId);
    const cardDesc = descCards(payload.cardIds);

    const result = discardCards(this.engine, client.sessionId, payload.cardIds);
    if (result.error) {
      this.log.warn(`discardCards rejected — "${name}": ${result.error} (cards: ${cardDesc})`);
      client.send("error", { message: result.error });
      return;
    }

    this.log.info(`[${name}] discarded ${cardDesc} → ${this.formatEngineSnapshot(result.state)}`);
    this.engine = result.state;
    this.syncStateFromEngine();
  }

  private handleYield(client: Client) {
    if (!this.engine) return;
    const name = this.playerName(client.sessionId);

    const result = yieldTurn(this.engine, client.sessionId);
    if (result.error) {
      this.log.warn(`yield rejected — "${name}": ${result.error}`);
      client.send("error", { message: result.error });
      return;
    }

    this.log.info(`[${name}] yielded → ${this.formatEngineSnapshot(result.state)}`);
    this.engine = result.state;
    this.syncStateFromEngine();
  }

  private handleUseJesterPower(client: Client) {
    if (!this.engine) return;
    const name = this.playerName(client.sessionId);

    const result = useJesterPower(this.engine, client.sessionId);
    if (result.error) {
      this.log.warn(`useJesterPower rejected — "${name}": ${result.error}`);
      client.send("error", { message: result.error });
      return;
    }

    const newHand = result.state.players.get(client.sessionId)?.hand ?? [];
    this.log.info(`[${name}] used Jester Power — new hand: ${descCards(newHand)} (${result.state.soloJestersAvailable} charges left) → ${this.formatEngineSnapshot(result.state)}`);
    this.engine = result.state;
    this.syncStateFromEngine();
  }

  private handleSelectNextPlayer(client: Client, payload: { sessionId: string }) {
    if (!this.engine) return;
    if (!payload?.sessionId) return;

    const callerName = this.playerName(client.sessionId);
    const targetName = this.playerName(payload.sessionId);

    const result = selectNextPlayer(this.engine, client.sessionId, payload.sessionId);
    if (result.error) {
      this.log.warn(`selectNextPlayer rejected — "${callerName}": ${result.error}`);
      client.send("error", { message: result.error });
      return;
    }

    this.log.info(`[${callerName}] selected next player: "${targetName}" → ${this.formatEngineSnapshot(result.state)}`);
    this.engine = result.state;
    this.syncStateFromEngine();
  }

  // -------------------------------------------------------------------------
  // Game start
  // -------------------------------------------------------------------------

  private startGame() {
    const playerList = [...this.state.players.entries()]
      .filter(([, p]) => p.connected)
      .map(([sessionId, p]) => ({ sessionId, name: p.name }));

    this.engine = initGame(playerList);

    const playerDesc = playerList.map((p) => `"${p.name}"(${p.sessionId})`).join(", ");
    const m = this.engine.currentMonster;
    this.log.info(
      `Game started — players: [${playerDesc}] | first monster: ${descCard(m.cardId)} HP ${m.maxHp} ATK ${m.attack}` +
      (this.engine.soloJestersAvailable > 0 ? ` | solo mode, ${this.engine.soloJestersAvailable} Jester charges` : "")
    );

    this.syncStateFromEngine();

    for (const client of this.clients) {
      this.sendHandUpdate(client);
    }

    // Log initial hands
    for (const [sid, ep] of this.engine.players) {
      this.log.info(`  Hand dealt to "${ep.name}"(${sid}): ${descCards(ep.hand)}`);
    }

    this.lock();
  }

  // -------------------------------------------------------------------------
  // Private hand delivery
  // -------------------------------------------------------------------------

  private sendHandUpdate(client: Client) {
    if (!this.engine) return;
    const ep = this.engine.players.get(client.sessionId);
    if (ep) {
      client.send("handUpdate", { hand: ep.hand });
    }
  }

  /** Broadcast visual events (kill effects, etc.) to all clients. */
  private broadcastGameEvents(events: { type: string; [key: string]: unknown }[]) {
    const clientEvents: GameEvent[] = events.filter(
      (e) => e.type === "monsterDefeated" || e.type === "victory" || e.type === "defeat"
    ) as GameEvent[];
    if (clientEvents.length > 0) {
      this.broadcast("gameEvents", clientEvents);
    }
  }

  /** Send hand updates to all connected clients whose hand changed. */
  private broadcastHandUpdates() {
    for (const client of this.clients) {
      this.sendHandUpdate(client);
    }
  }

  // -------------------------------------------------------------------------
  // Schema sync
  // -------------------------------------------------------------------------

  private syncStateFromEngine() {
    if (!this.engine) return;
    const eng = this.engine;

    this.state.phase = eng.phase;
    this.state.tavernSize = eng.tavern.length;
    this.state.discardSize = eng.discard.length;
    this.state.pendingDamage = eng.pendingDamage;
    this.state.currentPlayerSessionId = eng.currentPlayerSessionId;
    this.state.monstersRemaining = eng.monstersRemaining;
    this.state.turnNumber = eng.turnNumber;
    this.state.soloJestersAvailable = eng.soloJestersAvailable;
    this.state.soloJestersUsed = eng.soloJestersUsed;

    syncMonster(this.state.currentMonster, eng.currentMonster);

    this.state.castleDeck.splice(0);
    for (const id of eng.castleDeck) this.state.castleDeck.push(id);

    this.state.boardCards.splice(0);
    for (const id of eng.boardCards) this.state.boardCards.push(id);

    this.state.discardRequired.clear();
    for (const [sid, count] of eng.discardRequired) {
      this.state.discardRequired.set(sid, count);
    }

    for (const [sid, ep] of eng.players) {
      let ps = this.state.players.get(sid);
      if (!ps) {
        ps = new PlayerState();
        this.state.players.set(sid, ps);
      }
      syncPlayer(ps, ep, eng.currentPlayerSessionId);
    }

    this.broadcastHandUpdates();
  }

  // -------------------------------------------------------------------------
  // Logging helpers
  // -------------------------------------------------------------------------

  private playerName(sessionId: string): string {
    return (
      this.engine?.players.get(sessionId)?.name ??
      this.state.players.get(sessionId)?.name ??
      sessionId
    );
  }

  private formatEngineSnapshot(state: EngineState): string {
    const m = state.currentMonster;
    const monsterDesc = m ? `${descCard(m.cardId)} HP ${m.currentHp}/${m.maxHp}` : "—";
    const currentName = this.engine?.players.get(state.currentPlayerSessionId)?.name
      ?? state.currentPlayerSessionId;
    const discardInfo = state.discardRequired.size > 0
      ? ` | discard: ${[...state.discardRequired.entries()].map(([sid, v]) => `${this.playerName(sid)}=${v}`).join(", ")}`
      : "";
    return `phase=${state.phase} | turn#${state.turnNumber} | monster=${monsterDesc} | next="${currentName}"${discardInfo}`;
  }

  private formatEvents(events: PlayEvent[]): string {
    const parts: string[] = [];
    for (const e of events) {
      switch (e.type) {
        case "monsterDefeated": parts.push(`MONSTER DEFEATED (${e.perfectKill ? "exact kill" : "overkill"})`); break;
        case "victory":         parts.push("VICTORY"); break;
        case "defeat":          parts.push("DEFEAT"); break;
        case "jokerPlayed":     parts.push("joker played"); break;
        case "draw":            parts.push(`draw ×${e.count}`); break;
        case "heal":            parts.push(`heal ×${e.count}`); break;
        case "shields":         parts.push(`shields +${e.amount}`); break;
        case "discardPhase":    parts.push(`discard phase`); break;
        case "nextPlayerSelectPhase": parts.push("select next player"); break;
      }
    }
    return parts.length ? `[${parts.join(", ")}]` : "[—]";
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function syncMonster(schema: MonsterState, eng: EngineMonster) {
  schema.cardId = eng.cardId;
  schema.rank = eng.rank;
  schema.suit = eng.suit;
  schema.maxHp = eng.maxHp;
  schema.currentHp = eng.currentHp;
  schema.attack = eng.attack;
  schema.immunityNegated = eng.immunityNegated;
  schema.spadeReduction = eng.spadeReduction;
}

function syncPlayer(schema: PlayerState, eng: EnginePlayer, currentPlayerSessionId: string) {
  schema.name = eng.name;
  schema.handCount = eng.hand.length;
  schema.shields = eng.shields;
  schema.isCurrentTurn = eng.sessionId === currentPlayerSessionId;
  schema.connected = eng.connected;
  schema.hand = eng.hand; // server-only field
}
