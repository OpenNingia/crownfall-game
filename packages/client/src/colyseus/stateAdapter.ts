import type { GamePhase, GameState, MonsterInfo, PlayerInfo } from "@crownfall/shared";

/**
 * Converts Colyseus schema proxy → plain JS for Zustand.
 * `existingPlayers` is passed in so we can preserve hands (sent via handUpdate, not schema).
 */
export function adaptState(
  state: any,
  existingPlayers?: Map<string, PlayerInfo>
): Partial<GameState> {
  const players = new Map<string, PlayerInfo>();

  state.players.forEach((player: any, sessionId: string) => {
    const existingHand = existingPlayers?.get(sessionId)?.hand ?? [];
    players.set(sessionId, {
      sessionId,
      name: player.name,
      handCount: player.handCount,
      hand: existingHand, // preserved from handUpdate message
      shields: player.shields,
      isCurrentTurn: player.isCurrentTurn,
      connected: player.connected,
      ready: player.ready,
    });
  });

  const castleDeck: number[] = [];
  state.castleDeck?.forEach((id: number) => castleDeck.push(id));

  const boardCards: number[] = [];
  state.boardCards?.forEach((id: number) => boardCards.push(id));

  const discardRequired = new Map<string, number>();
  state.discardRequired?.forEach((count: number, sid: string) => {
    discardRequired.set(sid, count);
  });

  const monster = state.currentMonster;
  const currentMonster: MonsterInfo | null = monster?.cardId
    ? {
        cardId: monster.cardId,
        rank: monster.rank,
        suit: monster.suit,
        maxHp: monster.maxHp,
        currentHp: monster.currentHp,
        attack: monster.attack,
        immunityNegated: monster.immunityNegated,
      }
    : null;

  return {
    phase: state.phase as GamePhase,
    players,
    currentMonster,
    castleDeck,
    boardCards,
    tavernSize: state.tavernSize,
    discardSize: state.discardSize,
    pendingDamage: state.pendingDamage,
    currentPlayerSessionId: state.currentPlayerSessionId,
    discardRequired,
    monstersRemaining: state.monstersRemaining,
    turnNumber: state.turnNumber,
  };
}
