import type { GameEvent } from "@crownfall/shared";

type Handler = (event: GameEvent) => void;

const handlers = new Set<Handler>();

export function subscribeToGameEvents(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function emitGameEvents(events: GameEvent[]) {
  for (const event of events) {
    for (const handler of handlers) handler(event);
  }
}
