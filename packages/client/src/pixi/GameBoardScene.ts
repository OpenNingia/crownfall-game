import { Application, Graphics, Text, TextStyle } from "pixi.js";
import { getOrCreatePixiApp, destroyPixiApp } from "./PixiApp.js";
import type { GameStoreState } from "../store/gameStore.js";
import type { GameEvent } from "@crownfall/shared";

/**
 * GameBoardScene manages the PixiJS canvas for ambient visual effects.
 * Core game state display is handled by React; PixiJS adds:
 *  - Damage flash on hit
 *  - Particle burst on monster kill
 *  - Gold flash + "PERFECT!" text on exact-HP kill
 */
export class GameBoardScene {
  private app: Application | null = null;
  private container: HTMLElement | null = null;
  private lastHp: number = -1;

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    try {
      this.app = await getOrCreatePixiApp(container);
    } catch (e) {
      console.warn("[PixiJS] Could not initialise canvas:", e);
    }
  }

  update(state: Partial<GameStoreState>): void {
    if (!this.app) return;

    const monster = state.currentMonster;
    if (!monster) return;

    // Flash effect when monster takes damage
    if (this.lastHp !== -1 && monster.currentHp < this.lastHp) {
      this.flashDamage();
    }
    this.lastHp = monster.currentHp;
  }

  handleGameEvent(event: GameEvent): void {
    if (event.type === "monsterDefeated") {
      this.playKillEffect(event.perfectKill, event.suit);
    }
  }

  private flashDamage(): void {
    if (!this.app) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.filter = "sepia(1) saturate(5) hue-rotate(-20deg)";
    setTimeout(() => {
      if (canvas) canvas.style.filter = "";
    }, 200);
  }

  private playKillEffect(perfectKill: boolean, suit: string): void {
    if (!this.app) return;

    const stage = this.app.stage;
    const cx = this.app.screen.width / 2;
    const cy = this.app.screen.height / 2;

    const suitColor = suitToColor(suit);
    const particleCount = perfectKill ? 60 : 28;

    type Particle = { g: Graphics; vx: number; vy: number; life: number; maxLife: number };
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const speed = perfectKill ? 180 + Math.random() * 320 : 120 + Math.random() * 180;
      const size = perfectKill ? 4 + Math.random() * 9 : 3 + Math.random() * 6;
      const life = 0.55 + Math.random() * 0.5;
      const color = perfectKill ? rainbowColor(i / particleCount) : suitColor;

      const g = new Graphics();
      g.circle(0, 0, size).fill({ color });
      g.x = cx;
      g.y = cy;
      stage.addChild(g);

      particles.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life });
    }

    // Gold flash overlay for perfect kill
    let flash: Graphics | null = null;
    if (perfectKill) {
      flash = new Graphics();
      flash.rect(0, 0, this.app.screen.width, this.app.screen.height).fill({ color: 0xffd700, alpha: 0.4 });
      stage.addChildAt(flash, 0);
    }

    // "PERFECT!" label
    let label: Text | null = null;
    if (perfectKill) {
      label = new Text({
        text: "PERFECT!",
        style: new TextStyle({
          fontFamily: "'Arial Black', Impact, Arial",
          fontSize: 58,
          fontWeight: "900",
          fill: "#FFD700",
          stroke: { color: "#000000", width: 6 },
          dropShadow: {
            alpha: 0.9,
            blur: 14,
            color: "#ff8c00",
            distance: 4,
            angle: Math.PI / 4,
          },
        }),
      });
      label.anchor.set(0.5);
      label.x = cx;
      label.y = cy - 60;
      label.alpha = 0;
      label.scale.set(0.3);
      stage.addChild(label);
    }

    let elapsed = 0;

    const tickerFn = (ticker: { deltaTime: number }) => {
      const dt = ticker.deltaTime / 60; // convert frames → seconds (at 60fps baseline)
      elapsed += dt;

      // Fade out gold flash
      if (flash) {
        flash.alpha = Math.max(0, 0.4 - elapsed * 2);
      }

      // Animate "PERFECT!" label: pop in, hold, fade out
      if (label) {
        const popT = Math.min(elapsed / 0.18, 1);
        const eased = 1 - Math.pow(1 - popT, 3);
        const scaleVal = popT < 1 ? eased * 1.12 : Math.min(1.12, 1 + (1 - Math.min(elapsed - 0.18, 0.1) / 0.1) * 0.12);
        label.scale.set(Math.max(0, scaleVal));
        label.alpha = elapsed > 0.75 ? Math.max(0, 1 - (elapsed - 0.75) / 0.45) : Math.min(1, elapsed / 0.1);
      }

      // Animate particles: move, gravity, fade
      let anyAlive = false;
      for (const p of particles) {
        p.life -= dt;
        if (p.life > 0) {
          anyAlive = true;
          p.g.x += p.vx * dt;
          p.g.y += p.vy * dt;
          p.vy += 340 * dt; // gravity pull
          p.g.alpha = p.life / p.maxLife;
        } else {
          p.g.alpha = 0;
        }
      }

      // Cleanup when everything has finished
      const labelDone = !label || label.alpha <= 0;
      const flashDone = !flash || flash.alpha <= 0;
      if (!anyAlive && labelDone && flashDone) {
        this.app!.ticker.remove(tickerFn);
        for (const p of particles) stage.removeChild(p.g);
        if (label) stage.removeChild(label);
        if (flash) stage.removeChild(flash);
      }
    };

    this.app.ticker.add(tickerFn);
  }

  destroy(): void {
    destroyPixiApp();
    this.app = null;
    this.container = null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function suitToColor(suit: string): number {
  switch (suit) {
    case "hearts":   return 0xff2244;
    case "diamonds": return 0xff7722;
    case "clubs":    return 0x22cc55;
    case "spades":   return 0x4466ff;
    default:         return 0xffffff;
  }
}

/** Map t ∈ [0, 1] to a full-spectrum rainbow hex color. */
function rainbowColor(t: number): number {
  const h = (t * 360) / 60;
  const f = h - Math.floor(h);
  const q = 1 - f;
  let r = 0, g = 0, b = 0;
  const hi = Math.floor(h) % 6;
  if      (hi === 0) { r = 1;  g = f; }
  else if (hi === 1) { r = q;  g = 1; }
  else if (hi === 2) {         g = 1;  b = f; }
  else if (hi === 3) {         g = q;  b = 1; }
  else if (hi === 4) { r = f;          b = 1; }
  else               { r = 1;          b = q; }
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}
