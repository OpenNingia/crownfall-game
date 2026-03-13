import { Application } from "pixi.js";

let pixiApp: Application | null = null;

export async function getOrCreatePixiApp(container: HTMLElement): Promise<Application> {
  if (pixiApp) return pixiApp;

  const app = new Application();
  await app.init({
    resizeTo: container,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);
  pixiApp = app;
  return app;
}

export function destroyPixiApp() {
  if (pixiApp) {
    pixiApp.destroy(true);
    pixiApp = null;
  }
}
