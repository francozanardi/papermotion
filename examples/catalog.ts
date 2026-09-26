import type { Stage } from '../src';

/** Builds an example's stage on a canvas; URL params allow per-example options. */
export type MakeStage = (canvas: HTMLCanvasElement, params: URLSearchParams) => Stage;

/**
 * Every example, by name. Scenes load lazily, so this list can be read anywhere
 * (the player, the render script) without pulling in the scenes themselves.
 */
export const EXAMPLES: Record<string, () => Promise<MakeStage>> = {
  kite: async () => {
    const { KiteScene } = await import('./kite/main');
    return (canvas, params) => {
      const lab = params.get('lab');
      return new KiteScene(canvas, lab ? { bone: lab, zoom: 3 } : undefined);
    };
  },
  rooftops: async () => {
    const { RooftopsScene } = await import('./rooftops/main');
    return canvas => new RooftopsScene(canvas);
  },
  demo: async () => {
    const { DemoScene } = await import('./demo/main');
    return canvas => new DemoScene(canvas);
  },
  rain: async () => {
    const { RainScene } = await import('./rain/main');
    return canvas => new RainScene(canvas);
  },
  sea: async () => {
    const { SeaScene } = await import('./sea/main');
    return canvas => new SeaScene(canvas);
  },
};
