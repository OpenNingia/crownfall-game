import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore.js";
import { subscribeToGameEvents } from "../events/gameEventBus.js";
import { sfx } from "./SoundManager.js";

/**
 * Mounts sound-effect triggers by subscribing to game state changes and
 * discrete game events. Mount once inside GamePage.
 */
export function useSfxTriggers() {
  const phase = useGameStore((s) => s.phase);
  const mySessionId = useGameStore((s) => s.mySessionId);
  const discardRequired = useGameStore((s) => s.discardRequired);
  const monsterHp = useGameStore((s) => s.currentMonster?.currentHp ?? -1);

  const myDiscardRequired = mySessionId
    ? (discardRequired?.get(mySessionId) ?? 0)
    : 0;

  const prevPhaseRef = useRef<typeof phase>(null);
  const prevHpRef = useRef(monsterHp);
  // Mirrors SlashEffect's hitActiveRef to avoid re-triggering while in discard phase
  const hitActiveRef = useRef(false);

  // Victory / defeat
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === phase) return;
    if (phase === "victory") sfx.play("victory");
    if (phase === "defeat") sfx.play("defeat");
  }, [phase]);

  // Player takes damage (same rising-edge logic as SlashEffect)
  useEffect(() => {
    const isHit = phase === "awaiting_discard" && myDiscardRequired > 0;
    if (isHit && !hitActiveRef.current) {
      hitActiveRef.current = true;
      sfx.play("player_hit");
    }
    if (!isHit) {
      hitActiveRef.current = false;
    }
  }, [phase, myDiscardRequired]);

  // Monster takes damage — skip when HP hits 0 (kill sound covers that)
  useEffect(() => {
    const prev = prevHpRef.current;
    prevHpRef.current = monsterHp;
    if (monsterHp > 0 && prev > monsterHp) {
      sfx.play("monster_hit");
    }
  }, [monsterHp]);

  // Monster defeated (normal or perfect kill)
  useEffect(() => {
    return subscribeToGameEvents((event) => {
      if (event.type === "monsterDefeated") {
        sfx.play(event.perfectKill ? "perfect_kill" : "monster_kill");
      }
    });
  }, []);
}
