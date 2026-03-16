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
  type EngineState,
  type EngineMonster,
  type EnginePlayer,
} from "../game/GameEngine.js";
import { MIN_PLAYERS, MAX_PLAYERS, type GameEvent } from "@crownfall/shared";

type RoomOpts = { state: CrownfallState };

export class CrownfallRoom extends Room<RoomOpts> {
  private engine: EngineState | null = null;

  onCreate(_options: Record<string, unknown>) {
    this.setState(new CrownfallState());
    this.maxClients = MAX_PLAYERS;

    this.onMessage("ready", (client) => this.handleReady(client));
    this.onMessage("playCards", (client, payload) => this.handlePlayCards(client, payload));
    this.onMessage("discardCards", (client, payload) => this.handleDiscardCards(client, payload));
    this.onMessage("selectNextPlayer", (client, payload) =>
      this.handleSelectNextPlayer(client, payload)
    );
    this.onMessage("yield", (client) => this.handleYield(client));
  }

  onJoin(client: Client, options: Record<string, unknown>) {
    if (this.state.phase !== "lobby") return;

    const name = String(options?.name ?? `Player${this.clients.length}`);
    const player = new PlayerState();
    player.name = name;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
  }

  async onLeave(client: Client, code?: number) {
    const CONSENTED_CODE = 4000;
    const consented = code === CONSENTED_CODE;

    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    if (this.engine) {
      const ep = this.engine.players.get(client.sessionId);
      if (ep) ep.connected = false;
    }

    if (!consented) {
      try {
        await this.allowReconnection(client, 30);
        if (player) player.connected = true;
        if (this.engine) {
          const ep = this.engine.players.get(client.sessionId);
          if (ep) ep.connected = true;
          this.sendHandUpdate(client);
        }
      } catch {
        this.state.players.delete(client.sessionId);
        if (this.engine) removePlayer(this.engine, client.sessionId);
      }
    }
  }

  onDispose() {}

  // -------------------------------------------------------------------------
  // Message handlers
  // -------------------------------------------------------------------------

  private handleReady(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== "lobby") return;

    player.ready = !player.ready;

    const connectedPlayers = [...this.state.players.values()].filter((p) => p.connected);
    const allReady = connectedPlayers.every((p) => p.ready);

    if (allReady && connectedPlayers.length >= MIN_PLAYERS) {
      this.startGame();
    }
  }

  private handlePlayCards(client: Client, payload: { cardIds: number[] }) {
    if (!this.engine) return;
    if (!Array.isArray(payload?.cardIds)) return;

    const result = playCards(this.engine, client.sessionId, payload.cardIds);
    if (result.error) {
      client.send("error", { message: result.error });
      return;
    }

    this.engine = result.state;
    this.syncStateFromEngine();
    this.broadcastGameEvents(result.events);
  }

  private handleDiscardCards(client: Client, payload: { cardIds: number[] }) {
    if (!this.engine) return;
    if (!Array.isArray(payload?.cardIds)) return;

    const result = discardCards(this.engine, client.sessionId, payload.cardIds);
    if (result.error) {
      client.send("error", { message: result.error });
      return;
    }

    this.engine = result.state;
    this.syncStateFromEngine();
  }

  private handleYield(client: Client) {
    if (!this.engine) return;
    const result = yieldTurn(this.engine, client.sessionId);
    if (result.error) {
      client.send("error", { message: result.error });
      return;
    }
    this.engine = result.state;
    this.syncStateFromEngine();
  }

  private handleSelectNextPlayer(client: Client, payload: { sessionId: string }) {
    if (!this.engine) return;
    if (!payload?.sessionId) return;

    const result = selectNextPlayer(this.engine, client.sessionId, payload.sessionId);
    if (result.error) {
      client.send("error", { message: result.error });
      return;
    }

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
    this.syncStateFromEngine();

    // Send each player their private hand
    for (const client of this.clients) {
      this.sendHandUpdate(client);
    }

    this.lock();
  }

  // -------------------------------------------------------------------------
  // Private hand delivery
  // -------------------------------------------------------------------------

  /**
   * Send a targeted message to one client with their current hand.
   * This is the private-state fallback since @view() caused schema issues.
   */
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

    // Always push hand updates after any state change
    this.broadcastHandUpdates();
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
