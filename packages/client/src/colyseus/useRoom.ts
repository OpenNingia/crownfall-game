import { useCallback } from "react";
import { Room } from "@colyseus/sdk";
import { colyseusClient } from "./client.js";
import { adaptState } from "./stateAdapter.js";
import { useGameStore } from "../store/gameStore.js";
import { useLobbyStore } from "../store/lobbyStore.js";
import { emitGameEvents } from "../events/gameEventBus.js";
import type { GameEvent } from "@crownfall/shared";

interface SavedSession {
  roomId: string;
  sessionId: string;
}

function getSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem("crownfall_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(room: Room) {
  localStorage.setItem(
    "crownfall_session",
    JSON.stringify({ roomId: room.roomId, sessionId: room.sessionId })
  );
}

function clearSavedSession() {
  localStorage.removeItem("crownfall_session");
}

// Module-level ref so the room persists across component mounts/unmounts
let activeRoom: Room | null = null;

export function useRoom() {
  const setGameState = useGameStore((s) => s.setGameState);
  const setMySessionId = useGameStore((s) => s.setMySessionId);
  const setError = useLobbyStore((s) => s.setError);

  const attachListeners = useCallback(
    (room: Room) => {
      setMySessionId(room.sessionId);

      room.onStateChange((state: any) => {
        const existing = useGameStore.getState().players;
        const adapted = adaptState(state, existing);
        setGameState(adapted);
      });

      room.onMessage("handUpdate", (msg: { hand: number[] }) => {
        const store = useGameStore.getState();
        const players = store.players;
        if (!players) return;
        const me = players.get(room.sessionId);
        if (!me) return;
        const updated = new Map(players);
        updated.set(room.sessionId, { ...me, hand: msg.hand });
        store.setGameState({ players: updated });
      });

      room.onMessage("gameEvents", (events: GameEvent[]) => {
        emitGameEvents(events);
      });

      room.onMessage("error", (msg: { message: string }) => {
        console.error("[room error]", msg.message);
        setError(msg.message);
      });

      room.onLeave(() => {
        clearSavedSession();
      });

      room.onError((code: number, message?: string) => {
        console.error("[room onError]", code, message);
        clearSavedSession();
      });
    },
    [setGameState, setMySessionId, setError]
  );

  const joinOrCreate = useCallback(
    async (name: string) => {
      // Try reconnect first
      const saved = getSavedSession();
      if (saved) {
        try {
          const room = await colyseusClient.reconnect(saved.roomId, saved.sessionId);
          activeRoom = room;
          saveSession(room);
          attachListeners(room);
          return room;
        } catch {
          clearSavedSession();
        }
      }

      const room = await colyseusClient.joinOrCreate("crownfall", { name });
      activeRoom = room;
      saveSession(room);
      attachListeners(room);
      return room;
    },
    [attachListeners]
  );

  const send = useCallback((type: string, payload?: unknown) => {
    activeRoom?.send(type, payload);
  }, []);

  const leave = useCallback(() => {
    activeRoom?.leave();
    activeRoom = null;
    clearSavedSession();
  }, []);

  return { joinOrCreate, send, leave };
}
