/**
 * Draft resolution. Scenes always draw in frame pixels (1920 × 1080 by default); a canvas can hold
 * fewer device pixels than that (a half-size draft renders a quarter of them). The few things the
 * canvas measures in device pixels whatever the transform (shadow blur and offset, filter blurs,
 * screen-space resets) go through these helpers so a draft looks like a smaller final frame.
 */

const scales = new WeakMap<HTMLCanvasElement, number>();

/** Set how many device pixels this canvas has per frame pixel (1 = full resolution). */
export function setPixelScale(canvas: HTMLCanvasElement, scale: number): void {
  scales.set(canvas, scale);
}

/** Device pixels per frame pixel on the canvas `ctx` draws into: 1 at full resolution, 0.5 in a half-size draft. */
export function pixelScale(ctx: { canvas: HTMLCanvasElement | OffscreenCanvas }): number {
  return scales.get(ctx.canvas as HTMLCanvasElement) ?? 1;
}

/** The frame's size in frame pixels (what scenes draw in), whatever the canvas resolution. */
export function frameSize(ctx: CanvasRenderingContext2D): { width: number; height: number } {
  const s = pixelScale(ctx);
  return { width: ctx.canvas.width / s, height: ctx.canvas.height / s };
}

/** Reset the transform to screen space in frame pixels (top-left origin, no camera). */
export function screenSpace(ctx: CanvasRenderingContext2D): void {
  const s = pixelScale(ctx);
  ctx.setTransform(s, 0, 0, s, 0, 0);
}

/** A canvas filter with its `blur(Npx)` radii scaled to device pixels. */
export function scaleFilter(filter: string, scale: number): string {
  return scale === 1 ? filter : filter.replace(/blur\(([\d.]+)px\)/g, (_, r) => `blur(${+r * scale}px)`);
}
