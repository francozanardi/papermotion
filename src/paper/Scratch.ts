import { pixelScale, setPixelScale } from './resolution';

/** A rectangle in device pixels. */
export interface Box { x: number; y: number; w: number; h: number }

/**
 * A stack of offscreen canvases the size of the frame, reused every frame
 * (translucent layers, merged sheets and their effects).
 */
export class Scratch {
  private readonly pool: CanvasRenderingContext2D[] = [];
  private used = 0;

  /** `frame` is the canvas the scratch canvases match, in size and pixel scale. */
  constructor(private readonly frame: () => HTMLCanvasElement) {}

  /**
   * A cleared canvas with an identity transform. Give it back with `release`, last borrowed first.
   * With `clip`, only that box is cleared and everything drawn stays inside it. Use it for passes
   * confined to a box: composites like 'destination-in' and 'source-in' otherwise touch (and clear)
   * every pixel of the frame-sized canvas, which in a software canvas costs a full-frame pass each.
   */
  borrow(clip?: Box): CanvasRenderingContext2D {
    const frame = this.frame(), { width, height } = frame;
    const g = (this.pool[this.used++] ??= document.createElement('canvas').getContext('2d')!);
    if (g.canvas.width !== width || g.canvas.height !== height) { g.canvas.width = width; g.canvas.height = height; }
    setPixelScale(g.canvas, pixelScale({ canvas: frame }));
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (clip) {
      g.beginPath();
      g.rect(clip.x, clip.y, clip.w, clip.h);
      g.clip();
      g.clearRect(clip.x, clip.y, clip.w, clip.h);
    } else {
      g.clearRect(0, 0, width, height);
    }
    return g;
  }

  release(count = 1): void {
    for (let i = 0; i < count; i++) this.pool[--this.used].restore();
  }
}

/** Copy `box` of `from` onto `to` at the same place, offset by (dx, dy). */
export function blit(to: CanvasRenderingContext2D, from: CanvasRenderingContext2D, b: Box, dx = 0, dy = 0): void {
  to.drawImage(from.canvas, b.x, b.y, b.w, b.h, b.x + dx, b.y + dy, b.w, b.h);
}
