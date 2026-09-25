/** A rectangle in device pixels. */
export interface Box { x: number; y: number; w: number; h: number }

/**
 * A stack of offscreen canvases the size of the frame, reused every frame
 * (translucent layers, merged sheets and their effects).
 */
export class Scratch {
  private readonly pool: HTMLCanvasElement[] = [];
  private used = 0;

  constructor(private readonly size: () => { width: number; height: number }) {}

  /** A cleared canvas with an identity transform. Give it back with `release`, last borrowed first. */
  borrow(): CanvasRenderingContext2D {
    const canvas = (this.pool[this.used++] ??= document.createElement('canvas'));
    const { width, height } = this.size();
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const g = canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, width, height);
    return g;
  }

  release(count = 1): void {
    this.used -= count;
  }
}

/** Copy `box` of `from` onto `to` at the same place, offset by (dx, dy). */
export function blit(to: CanvasRenderingContext2D, from: CanvasRenderingContext2D, b: Box, dx = 0, dy = 0): void {
  to.drawImage(from.canvas, b.x, b.y, b.w, b.h, b.x + dx, b.y + dy, b.w, b.h);
}
