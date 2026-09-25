import { type V, smooth } from '../core/math';
import { noise1 } from '../core/random';
import { bounds, resample, tubePoly } from './geometry';
import { makeTexture } from './texture';

export interface PieceOpts {
  /** Stable id so the torn edge keeps its shape between frames. */
  seed: number;
  /** Edge wobble in px. */
  tear?: number;
  shadow?: number;
  /** Light "cut core" stroke along the edge. */
  edge?: boolean;
  texture?: number;
  /** Rim light on the side facing the scene light: color and crescent width (px). */
  rim?: { color: string; width: number };
}

/** Scene light: direction the light travels (unit-ish vector), e.g. {x:-1,y:0.2} for a low sun on the right. */
export interface Light { x: number; y: number }

/**
 * Draws polygons as pieces of cut paper: torn edge that boils every few frames,
 * fiber texture, drop shadow and a light cut edge.
 */
export class Paper {
  private readonly texture: CanvasPattern;
  private readonly scratch: HTMLCanvasElement[] = [];
  private depth = 0;
  private ctx: CanvasRenderingContext2D;
  boil = 0;
  light: Light = { x: -0.8, y: 0.6 };

  constructor(private readonly main: CanvasRenderingContext2D) {
    this.ctx = main;
    this.texture = main.createPattern(makeTexture(512, 11), 'repeat')!;
  }

  /** The context pieces are currently drawn into (for gradients). */
  get context(): CanvasRenderingContext2D { return this.ctx; }

  /**
   * Draw a group of pieces as one sheet and composite it with `alpha` / `blend`:
   * vellum and tracing paper (jellyfish, light shafts, ghosts). Overlaps inside don't double up.
   */
  layer(alpha: number, draw: () => void, blend: GlobalCompositeOperation = 'source-over'): void {
    const outer = this.ctx;
    const canvas = (this.scratch[this.depth] ??= document.createElement('canvas'));
    const { width, height } = this.main.canvas;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const g = canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, width, height);
    g.setTransform(outer.getTransform());
    this.ctx = g; this.depth++;
    try { draw(); } finally { this.ctx = outer; this.depth--; }
    outer.save();
    outer.setTransform(1, 0, 0, 1, 0, 0);
    outer.globalAlpha = alpha;
    outer.globalCompositeOperation = blend;
    outer.drawImage(canvas, 0, 0);
    outer.restore();
  }

  /** Call once per rendered frame; the edge changes every `hold` frames, cycling 3 drawings. */
  setFrame(frame: number, hold = 3): void {
    this.boil = Math.floor(frame / hold) % 3;
  }

  piece(poly: V[], fill: string | CanvasGradient, o: PieceOpts): void {
    const ctx = this.ctx;
    const path = this.tornPath(poly, o.seed, o.tear ?? 2.2);

    ctx.save();
    if (o.shadow !== 0) {
      ctx.shadowColor = 'rgba(18, 10, 28, 0.38)';
      ctx.shadowBlur = o.shadow ?? 9;
      ctx.shadowOffsetY = (o.shadow ?? 9) * 0.45;
    }
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();

    if (o.rim) this.rimLight(path, fill, o.rim);

    const tex = o.texture ?? 0.28;
    if (tex > 0) {
      ctx.save();
      ctx.clip(path);
      ctx.globalAlpha = tex;
      ctx.globalCompositeOperation = 'overlay';
      ctx.translate((o.seed * 97) % 512, (o.seed * 57) % 512);
      ctx.fillStyle = this.texture;
      const b = bounds(poly);
      ctx.fillRect(b.x - 600, b.y - 600, b.w + 1200, b.h + 1200);
      ctx.restore();
    }

    if (o.edge !== false) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 246, 232, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.stroke(path);
      ctx.restore();
    }
  }

  /** A tube along a polyline with tapering width and round caps (rubber-hose limb). */
  tube(pts: V[], w0: number, w1: number, fill: string, o: PieceOpts): void {
    this.piece(tubePoly(smooth(pts, 6), u => w0 + (w1 - w0) * u), fill, o);
  }

  /** A strip along a polyline with an arbitrary width profile `width(u)`, u in 0…1 (locks, leaves, petals). */
  ribbon(pts: V[], width: (u: number) => number, fill: string, o: PieceOpts): void {
    this.piece(tubePoly(smooth(pts, 6), width), fill, o);
  }

  /** Thin line without paper treatment (strings). */
  line(pts: V[], color: string, width: number): void {
    const ctx = this.ctx;
    const s = smooth(pts, 4);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Lit crescent: inside the piece, paint the rim color, then cover it with the piece's own color
   * shifted away from the light — only the edge facing the light stays lit.
   */
  private rimLight(path: Path2D, fill: string | CanvasGradient, rim: { color: string; width: number }): void {
    const ctx = this.ctx, l = this.light;
    const n = Math.hypot(l.x, l.y) || 1;
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = rim.color;
    ctx.fill(path);
    ctx.translate((l.x / n) * rim.width, (l.y / n) * rim.width);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();
  }

  private tornPath(poly: V[], seed: number, tear: number): Path2D {
    const pts = resample(poly, 5);
    const z = this.boil * 41.3;
    const path = new Path2D();
    pts.forEach((p, i) => {
      const u = i * 0.21 + z;
      const x = p.x + (noise1(u, seed) + noise1(u * 4.1, seed + 3) * 0.35) * tear;
      const y = p.y + (noise1(u, seed + 7) + noise1(u * 4.1, seed + 9) * 0.35) * tear;
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
    });
    path.closePath();
    return path;
  }
}
