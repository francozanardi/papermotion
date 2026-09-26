import type { Stage } from '../src';

/** Builds a scene's stage on a canvas; URL params allow per-scene options. */
export type MakeStage = (canvas: HTMLCanvasElement, params: URLSearchParams) => Stage;

/**
 * Every scene in this project, by name. Scenes load lazily, so this list can be read anywhere
 * (the player, the render script) without pulling in the scenes themselves. Register new ones here.
 */
export const EXAMPLES: Record<string, () => Promise<MakeStage>> = {
  hello: async () => {
    const { HelloScene } = await import('./hello/main');
    return canvas => new HelloScene(canvas);
  },
};
