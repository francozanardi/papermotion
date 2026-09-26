import { type V, smooth, smoothClosed } from '../core/math';
import { noise1 } from '../core/random';
import { bounds, resample, tubePoly } from './geometry';
import { type Box, Scratch, blit } from './Scratch';
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
  /** Core shadow on the side turned away from the light: a darker band (use a translucent color). */
  shade?: { color: string; width: number };
}

/** Paper treatment for a merged sheet (see `Paper.sheet`). */
export interface SheetOpts {
  shadow?: number;
  /** Rim light along the silhouette's edge that faces the scene light. */
  rim?: { color: string; width: number };
  /** Core shadow: a darker band along the side turned away from the light (use a translucent color). */
  shade?: { color: string; width: number };
  texture?: number;
  /** Light cut edge around the silhouette. Default true. */
  edge?: boolean;
  /** World point the fiber texture sticks to (e.g. the character's root), so it travels with it. */
  anchor?: V;
  alpha?: number;
}


/** Scene light: direction the light travels (unit-ish vector), e.g. {x:-1,y:0.2} for a low sun on the right. */
export interface Light { x: number; y: number }

/**
 * Draws polygons as pieces of cut paper: torn edge that boils every few frames,
 * fiber texture, drop shadow and a light cut edge.
 */
export class Paper {
  private readonly texture: CanvasPattern;
  private readonly scratch: Scratch;
  private ctx: CanvasRenderingContext2D;
  /** Inside a sheet, pieces are drawn flat and their device-space bounds are collected here. */
  private flat: Box | null = null;
  private flatDepth = 0;
  boil = 0;
  light: Light = { x: -0.8, y: 0.6 };
  /**
   * Color of the light cut edge on every piece. Tone it down for far layers at night, where a bright
   * edge on dark shapes turns scenery into line art.
   */
  edgeColor = 'rgba(255, 246, 232, 0.28)';
  shadowColor = 'rgba(18, 10, 28, 0.38)';

  constructor(main: CanvasRenderingContext2D) {
    this.ctx = main;
    this.texture = main.createPattern(makeTexture(512, 11), 'repeat')!;
    this.scratch = new Scratch(() => main.canvas);
  }

  /** The context pieces are currently drawn into (for gradients). */
  get context(): CanvasRenderingContext2D { return this.ctx; }

  /**
   * Draw a group of pieces as one sheet and composite it with `alpha` / `blend`:
   * vellum and tracing paper (jellyfish, light shafts, ghosts). Overlaps inside don't double up.
   * `filter` is a canvas filter for the composite, e.g. `'blur(6px)'` for a layer out of focus.
   * Without a `blend` it composites the way the context currently does, so inside `paper.inside` a
   * translucent layer (a smear of mud) still stays within the sheet.
   */
  layer(alpha: number, draw: () => void, blend?: GlobalCompositeOperation, filter = 'none'): void {
    const outer = this.ctx, g = this.scratch.borrow();
    g.setTransform(outer.getTransform());
    this.ctx = g;
    try { draw(); } finally { this.ctx = outer; }
    outer.save();
    outer.setTransform(1, 0, 0, 1, 0, 0);
    outer.globalAlpha = alpha;
    if (blend) outer.globalCompositeOperation = blend;
    outer.filter = filter;
    outer.drawImage(g.canvas, 0, 0);
    outer.restore();
    this.scratch.release();
  }

  /**
   * The shadow a group casts on a backdrop behind it, from a point light in front (a fire, a lamp):
   * the group's silhouette, grown by `grow` away from `from` and filled flat. Shadow puppets on a cave
   * wall; a figure looming on a curtain. Draw it before the backdrop's foreground and the group itself.
   */
  castShadow(from: V, grow: number, draw: () => void, o: { color?: string; blur?: number; alpha?: number } = {}): void {
    const outer = this.ctx, g = this.scratch.borrow();
    g.setTransform(outer.getTransform());
    g.translate(from.x, from.y);
    g.scale(grow, grow);
    g.translate(-from.x, -from.y);
    this.ctx = g;
    try { draw(); } finally { this.ctx = outer; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = o.color ?? 'rgb(12, 6, 10)';
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    outer.save();
    outer.setTransform(1, 0, 0, 1, 0, 0);
    outer.globalAlpha = o.alpha ?? 0.5;
    outer.filter = `blur(${o.blur ?? 4}px)`;
    outer.drawImage(g.canvas, 0, 0);
    outer.restore();
    this.scratch.release();
  }

  /**
   * Cut a group of pieces out of ONE sheet of paper. Inside, pieces are drawn flat and merge into a
   * single silhouette (use them for the body, limbs, and markings like a white chest or a lighter near
   * leg); then the silhouette gets the paper treatment once: one drop shadow, one rim light along its
   * outer edge, one fiber texture and one cut edge. Characters read as one piece, not a pile of parts.
   *
   * @example
   * paper.sheet({ shadow: 9, rim: { color: '#b5bfff', width: 4 }, anchor: cat.root }, () => {
   *   paper.ribbon(tail, …); paper.ribbon(body, …); paper.tube(nearLeg, …, lighterFur, …); paper.piece(chest, …, white, …);
   * });
   */
  sheet(o: SheetOpts, draw: () => void): void {
    const outer = this.ctx, g = this.scratch.borrow();
    const parent = this.flat;
    g.setTransform(outer.getTransform());
    this.ctx = g; this.flat = null; this.flatDepth++;
    let box: Box | null;
    try { draw(); } finally { box = this.flat as Box | null; this.ctx = outer; this.flat = parent; this.flatDepth--; }
    if (!box) { this.scratch.release(); return; }

    const m = outer.getTransform(), scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    const pad = Math.ceil(Math.max(o.rim?.width ?? 0, o.shade?.width ?? 0) * scale + 4);
    const b = clip({ x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }, g.canvas);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (o.shade) this.sheetBand(g, b, o.shade, scale, -1);
    if (o.rim) this.sheetBand(g, b, o.rim, scale, 1);
    if ((o.texture ?? 0.28) > 0) this.sheetTexture(g, b, o.texture ?? 0.28, m, o.anchor);
    if (o.edge !== false) this.sheetEdge(g, b, scale);

    outer.save();
    outer.setTransform(1, 0, 0, 1, 0, 0);
    outer.globalAlpha = o.alpha ?? 1;
    if (o.shadow !== 0) {
      outer.shadowColor = this.shadowColor;
      outer.shadowBlur = o.shadow ?? 9;
      outer.shadowOffsetY = (o.shadow ?? 9) * 0.45;
    }
    blit(outer, g, b);
    outer.restore();
    this.scratch.release();
    if (this.flatDepth > 0) this.track(b);
  }

  /**
   * Inside a `sheet`: draw markings clipped to what is already on it — a white chest, socks,
   * a collar, stripes. They add color without ever growing the silhouette.
   */
  inside(draw: () => void): void {
    if (this.flatDepth === 0) throw new Error('paper.inside() must be called within paper.sheet()');
    const g = this.ctx, prev = g.globalCompositeOperation, bounds = this.flat && { ...this.flat };
    g.globalCompositeOperation = 'source-atop';
    try { draw(); } finally { g.globalCompositeOperation = prev; this.flat = bounds; }
  }

  /**
   * Draw only within `region` (a plain polygon, not torn). Redraw a piece with its own seed in another
   * color inside a region to recolor part of it exactly along its edge: socks, a dipped tail tip, a hem.
   */
  clip(region: V[], draw: () => void): void {
    const g = this.ctx, path = new Path2D();
    region.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
    path.closePath();
    g.save();
    g.clip(path);
    try { draw(); } finally { g.restore(); }
  }

  /** Call once per rendered frame; the edge changes every `hold` frames, cycling 3 drawings. */
  setFrame(frame: number, hold = 3): void {
    this.boil = Math.floor(frame / hold) % 3;
  }

  piece(poly: V[], fill: string | CanvasGradient, o: PieceOpts): void {
    const ctx = this.ctx;
    const path = this.tornPath(poly, o.seed, o.tear ?? 2.2);
    if (this.flatDepth > 0) {
      ctx.fillStyle = fill;
      ctx.fill(path);
      this.trackPoly(poly, (o.tear ?? 2.2) * 1.5);
      return;
    }

    ctx.save();
    if (o.shadow !== 0) {
      ctx.shadowColor = this.shadowColor;
      ctx.shadowBlur = o.shadow ?? 9;
      ctx.shadowOffsetY = (o.shadow ?? 9) * 0.45;
    }
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();

    if (o.shade) this.coreShadow(path, o.shade);
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
      ctx.strokeStyle = this.edgeColor;
      ctx.lineWidth = 1.4;
      ctx.stroke(path);
      ctx.restore();
    }
  }

  /**
   * Fill a ready-made path of many small shapes at once (grass blades, fur, hatching): far cheaper than
   * a piece each. Inside a `sheet` they join its silhouette, so wrap them in one to get the paper
   * treatment; outside, they are drawn plain. `area` bounds the shapes, for the sheet.
   */
  fill(path: Path2D, fill: string | CanvasGradient, area: V[]): void {
    this.ctx.fillStyle = fill;
    this.ctx.fill(path);
    if (this.flatDepth > 0) this.trackPoly(area, 2);
  }

  /** A tube along a polyline with tapering width and round caps (rubber-hose limb). */
  tube(pts: V[], w0: number, w1: number, fill: string, o: PieceOpts): void {
    this.piece(tubePoly(smooth(pts, 6), u => w0 + (w1 - w0) * u), fill, o);
  }

  /** A smooth closed shape through a few control points (torsos, heads, bellies, leaves). */
  blob(pts: V[], fill: string, o: PieceOpts): void {
    this.piece(smoothClosed(pts, 6), fill, o);
  }

  /** A strip along a polyline with an arbitrary width profile `width(u)`, u in 0…1 (locks, leaves, petals). */
  ribbon(pts: V[], width: (u: number) => number, fill: string, o: PieceOpts): void {
    this.piece(tubePoly(smooth(pts, 6), width), fill, o);
  }

  /**
   * Text cut out of paper. Inside a `sheet` it merges like any other piece (and gets the sheet's shadow,
   * rim, edge and fibers); on its own it becomes a sheet of its own. `at` is the baseline start (or
   * center with `align: 'center'`); `angle` turns it around that point.
   */
  text(str: string, at: V, o: { font: string; color: string; align?: CanvasTextAlign; angle?: number; sheet?: SheetOpts }): void {
    if (this.flatDepth === 0) { this.sheet(o.sheet ?? { shadow: 8 }, () => this.text(str, at, o)); return; }
    const ctx = this.ctx;
    ctx.save();
    ctx.font = o.font;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.translate(at.x, at.y);
    ctx.rotate(o.angle ?? 0);
    ctx.fillStyle = o.color;
    ctx.fillText(str, 0, 0);
    const m = ctx.measureText(str);
    const x0 = -m.actualBoundingBoxLeft, x1 = m.actualBoundingBoxRight;
    this.trackPoly([{ x: x0, y: -m.actualBoundingBoxAscent }, { x: x1, y: -m.actualBoundingBoxAscent }, { x: x1, y: m.actualBoundingBoxDescent }, { x: x0, y: m.actualBoundingBoxDescent }], 4);
    ctx.restore();
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
    if (this.flatDepth > 0) this.trackPoly(s, width);
  }

  /** Dark band inside the piece on the side away from the light: everything but a copy shifted toward the light. */
  private coreShadow(path: Path2D, shade: { color: string; width: number }): void {
    const ctx = this.ctx, l = this.light, n = Math.hypot(l.x, l.y) || 1;
    const shifted = new Path2D();
    shifted.addPath(path, new DOMMatrix().translate((-l.x / n) * shade.width, (-l.y / n) * shade.width));
    shifted.rect(-1e5, -1e5, 2e5, 2e5);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = shade.color;
    ctx.fill(shifted, 'evenodd');
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

  /**
   * A band inside a merged sheet along the edge facing the light (`toward` 1: rim light) or away
   * from it (`toward` -1: core shadow): the silhouette minus itself shifted along the light.
   */
  private sheetBand(g: CanvasRenderingContext2D, b: Box, band: { color: string; width: number }, scale: number, toward: 1 | -1): void {
    const l = this.light, n = Math.hypot(l.x, l.y) || 1, r = this.scratch.borrow(), d = toward * band.width * scale;
    r.fillStyle = band.color;
    r.fillRect(b.x, b.y, b.w, b.h);
    r.globalCompositeOperation = 'destination-in';
    blit(r, g, b);
    r.globalCompositeOperation = 'destination-out';
    blit(r, g, b, (l.x / n) * d, (l.y / n) * d);
    g.globalCompositeOperation = 'source-atop';
    blit(g, r, b);
    g.globalCompositeOperation = 'source-over';
    this.scratch.release();
  }

  private sheetTexture(g: CanvasRenderingContext2D, b: Box, alpha: number, m: DOMMatrix, anchor?: V): void {
    const t = this.scratch.borrow();
    t.setTransform(m);
    t.translate(anchor?.x ?? 0, anchor?.y ?? 0);
    t.fillStyle = this.texture;
    const inv = m.inverse(), a = anchor ?? { x: 0, y: 0 };
    const corners = [inv.transformPoint({ x: b.x, y: b.y }), inv.transformPoint({ x: b.x + b.w, y: b.y + b.h })];
    const x0 = Math.min(corners[0].x, corners[1].x) - a.x, y0 = Math.min(corners[0].y, corners[1].y) - a.y;
    t.fillRect(x0 - 8, y0 - 8, Math.abs(corners[1].x - corners[0].x) + 16, Math.abs(corners[1].y - corners[0].y) + 16);
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    blit(t, g, b);
    g.globalAlpha = alpha;
    g.globalCompositeOperation = 'overlay';
    blit(g, t, b);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.scratch.release();
  }

  /** Cut edge on a merged sheet: the silhouette minus itself eroded by ~1.4px. */
  private sheetEdge(g: CanvasRenderingContext2D, b: Box, scale: number): void {
    const k = Math.max(1, 1.2 * scale), eroded = this.scratch.borrow(), ring = this.scratch.borrow();
    blit(eroded, g, b);
    eroded.globalCompositeOperation = 'destination-in';
    for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) blit(eroded, g, b, dx, dy);
    blit(ring, g, b);
    ring.globalCompositeOperation = 'destination-out';
    blit(ring, eroded, b);
    ring.globalCompositeOperation = 'source-in';
    ring.fillStyle = this.edgeColor;
    ring.fillRect(b.x, b.y, b.w, b.h);
    g.globalCompositeOperation = 'source-atop';
    blit(g, ring, b);
    g.globalCompositeOperation = 'source-over';
    this.scratch.release(2);
  }

  /** Grow the current sheet's bounds by a polygon in the current transform (plus a margin). */
  private trackPoly(poly: V[], margin: number): void {
    const m = this.ctx.getTransform();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of poly) {
      const x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const s = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) * margin;
    this.track({ x: x0 - s, y: y0 - s, w: x1 - x0 + 2 * s, h: y1 - y0 + 2 * s });
  }

  private track(b: Box): void {
    const f = this.flat;
    if (!f) { this.flat = { ...b }; return; }
    const x1 = Math.max(f.x + f.w, b.x + b.w), y1 = Math.max(f.y + f.h, b.y + b.h);
    f.x = Math.min(f.x, b.x); f.y = Math.min(f.y, b.y); f.w = x1 - f.x; f.h = y1 - f.y;
  }

  /**
   * The torn outline. The wobble is a function of arc length (not of point index), so sampling finer
   * in close-ups adds detail without changing the shape, and a zoom never makes the edge crawl.
   */
  private tornPath(poly: V[], seed: number, tear: number): Path2D {
    const m = this.ctx.getTransform(), scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
    const pts = resample(poly, Math.min(5, Math.max(0.8, 4 / scale)));
    const z = this.boil * 41.3;
    const path = new Path2D();
    let s = 0;
    pts.forEach((p, i) => {
      if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      const u = s * 0.042 + z;
      const x = p.x + (noise1(u, seed) + noise1(u * 4.1, seed + 3) * 0.35) * tear;
      const y = p.y + (noise1(u, seed + 7) + noise1(u * 4.1, seed + 9) * 0.35) * tear;
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
    });
    path.closePath();
    return path;
  }
}

/** Snap a box to whole pixels inside the canvas. */
function clip(b: Box, c: HTMLCanvasElement): Box {
  const x = Math.max(0, Math.floor(b.x)), y = Math.max(0, Math.floor(b.y));
  return { x, y, w: Math.max(1, Math.min(c.width, Math.ceil(b.x + b.w)) - x), h: Math.max(1, Math.min(c.height, Math.ceil(b.y + b.h)) - y) };
}
