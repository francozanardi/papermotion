import { rng } from '../core/random';

/**
 * Film finishing, drawn in screen space after everything else: a color grade, grain, bars,
 * flashes and fades. Keep the order: grade → flash → grain → fade → letterbox.
 */

let copy: HTMLCanvasElement | null = null;

/** Apply a canvas filter to the whole frame, e.g. `'grayscale(1) contrast(1.15)'`. */
export function grade(ctx: CanvasRenderingContext2D, filter: string): void {
  const { width, height } = ctx.canvas;
  copy ??= document.createElement('canvas');
  if (copy.width !== width || copy.height !== height) { copy.width = width; copy.height = height; }
  const g = copy.getContext('2d')!;
  g.clearRect(0, 0, width, height);
  g.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = filter;
  ctx.drawImage(copy, 0, 0);
  ctx.restore();
}

const grains: HTMLCanvasElement[] = [];

/** Film grain: one of a few seeded noise plates, shifted every frame. `amount` ≈ 0.05…0.2. */
export function grain(ctx: CanvasRenderingContext2D, frame: number, amount: number): void {
  if (!grains.length) for (let i = 0; i < 4; i++) grains.push(noisePlate(256, 101 + i));
  const r = rng(frame * 7 + 3), plate = grains[frame % grains.length];
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  const ox = -Math.floor(r() * 256), oy = -Math.floor(r() * 256);
  for (let x = ox; x < width; x += 256) for (let y = oy; y < height; y += 256) ctx.drawImage(plate, x, y);
  ctx.restore();
}

function noisePlate(size: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!, img = g.createImageData(size, size), r = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (r() + r() + r() - 1.5) * 120;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Cover the frame with a color at `alpha` (a fade to black, a flash of white with 'screen'). */
export function wash(ctx: CanvasRenderingContext2D, color: string, alpha: number, blend: GlobalCompositeOperation = 'source-over'): void {
  if (!(alpha > 0)) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.globalCompositeOperation = blend;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Black bars for a wider picture, e.g. `letterbox(ctx, 2.39)`. Returns the visible band's [top, bottom]. */
export function letterbox(ctx: CanvasRenderingContext2D, aspect: number): [number, number] {
  const { width, height } = ctx.canvas, h = Math.min(height, width / aspect), bar = Math.round((height - h) / 2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, bar);
  ctx.fillRect(0, height - bar, width, bar);
  ctx.restore();
  return [bar, height - bar];
}
