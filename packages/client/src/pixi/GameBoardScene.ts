import type { Application, Container } from "pixi.js";
import { getOrCreatePixiApp, destroyPixiApp } from "./PixiApp.js";
import type { GameStoreState } from "../store/gameStore.js";

/**
 * GameBoardScene manages the PixiJS canvas for ambient visual effects.
 * Core game state display is handled by React; PixiJS adds:
 *  - Animated particles
 *  - HP bar glow effects
 *  - Card travel animations between hand and board
 */
export class GameBoardScene {
  private app: Application | null = null;
  private container: HTMLElement | null = null;
  private lastHp: number = -1;

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    try {
      this.app = await getOrCreatePixiApp(container);
      this.setupScene();
    } catch (e) {
      console.warn("[PixiJS] Could not initialise canvas:", e);
    }
  }

  private setupScene(): void {
    if (!this.app) return;
    // Base setup — particles and effects added on update()
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

  private flashDamage(): void {
    if (!this.app) return;
    // Simple red flash overlay via canvas filter — lightweight approach
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.filter = "sepia(1) saturate(5) hue-rotate(-20deg)";
    setTimeout(() => {
      if (canvas) canvas.style.filter = "";
    }, 200);
  }

  destroy(): void {
    destroyPixiApp();
    this.app = null;
    this.container = null;
  }
}
