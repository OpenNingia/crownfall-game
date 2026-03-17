const SOUND_NAMES = [
  "player_hit",
  "monster_hit",
  "monster_kill",
  "perfect_kill",
  "card_play",
  "card_discard",
  "victory",
  "defeat",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

class SoundManager {
  private buffers = new Map<SoundName, HTMLAudioElement>();
  private muted = false;
  private volume = 0.7;

  constructor() {
    if (typeof Audio === "undefined") return;
    for (const name of SOUND_NAMES) {
      const audio = new Audio(`/sfx/${name}.ogg`);
      audio.preload = "auto";
      this.buffers.set(name, audio);
    }
  }

  play(name: SoundName) {
    if (this.muted) return;
    const original = this.buffers.get(name);
    if (!original) return;
    const audio = original.cloneNode() as HTMLAudioElement;
    audio.volume = this.volume;
    audio.play().catch(() => {});
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  isMuted() {
    return this.muted;
  }
}

export const sfx = new SoundManager();
