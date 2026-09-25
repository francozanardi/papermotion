/** Screen-space finishing touches drawn outside any camera layer: backdrop, vignette, captions. */

/** Fill the whole frame with a vertical gradient: `[stop 0…1, color]` pairs, top to bottom. */
export function fillGradient(ctx: CanvasRenderingContext2D, stops: readonly [number, string][]): void {
  const { width: w, height: h } = ctx.canvas;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Darken the frame's edges: `rgb` like [10, 6, 25], `strength` = opacity at the corners. */
export function vignette(ctx: CanvasRenderingContext2D, rgb: readonly [number, number, number], strength: number, inner = 0.45): void {
  const { width: w, height: h } = ctx.canvas;
  const g = ctx.createRadialGradient(w / 2, h / 2, h * inner, w / 2, h / 2, h * 1.1);
  g.addColorStop(0, `rgba(${rgb.join(', ')}, 0)`);
  g.addColorStop(1, `rgba(${rgb.join(', ')}, ${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export interface CaptionOpts {
  /** 0…1; nothing is drawn at 0. */
  alpha: number;
  /** Baseline y (px). Default 170. */
  y?: number;
  color?: string;
  /** Soft glow behind the letters, for contrast on busy backgrounds. */
  glow?: string;
  font?: string;
}

/** A centered line of text. */
export function caption(ctx: CanvasRenderingContext2D, text: string, o: CaptionOpts): void {
  if (!(o.alpha > 0)) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = o.alpha;
  ctx.font = o.font ?? '300 64px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = o.color ?? '#fff6e8';
  ctx.shadowColor = o.glow ?? 'rgba(10, 6, 30, 0.5)';
  ctx.shadowBlur = 14;
  ctx.fillText(text, ctx.canvas.width / 2, o.y ?? 170);
  ctx.restore();
}
