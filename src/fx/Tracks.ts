import type { V } from '../core/math';

/** One mark left on a surface: where, how big, how turned, and when. */
export interface Mark extends V {
  /** Half length and half width (px). */
  rx: number;
  ry: number;
  angle: number;
  /** Scene time it was made. */
  at: number;
  /** A stable number per mark, for its own seed or tone. */
  seed: number;
}

export interface TracksOpts {
  /** Oldest marks are dropped past this many. */
  capacity?: number;
  /** Don't stamp a new mark closer than this (px) to the previous one from the same source. */
  spacing?: number;
}

/**
 * Marks that stay where something touched a surface: footprints in snow, sand or mud, the furrow a
 * ball leaves, wheel ruts, drips. Stamp them from contacts; draw them yourself under the actors.
 */
export class Tracks {
  readonly marks: Mark[] = [];
  private readonly last = new Map<string, V>();
  private count = 0;

  constructor(private readonly o: TracksOpts = {}) {}

  /**
   * Leave a mark at `at`. With a `source` (a foot, a wheel), marks closer than `spacing` to that
   * source's previous one are skipped, so a foot planted for several steps leaves one print.
   * Returns whether a mark was made.
   */
  stamp(at: V, size: { rx: number; ry: number; angle?: number }, t: number, source?: string): boolean {
    if (source) {
      const prev = this.last.get(source);
      if (prev && Math.hypot(at.x - prev.x, at.y - prev.y) < (this.o.spacing ?? 0)) return false;
      this.last.set(source, { ...at });
    }
    this.marks.push({ x: at.x, y: at.y, rx: size.rx, ry: size.ry, angle: size.angle ?? 0, at: t, seed: ++this.count });
    const cap = this.o.capacity ?? 2000;
    if (this.marks.length > cap) this.marks.splice(0, this.marks.length - cap);
    return true;
  }

  /** Visit marks within [from, to] in x, oldest first, with their age at time `t`. */
  draw(from: number, to: number, t: number, each: (m: Mark, age: number) => void): void {
    for (const m of this.marks) if (m.x + m.rx >= from && m.x - m.rx <= to) each(m, t - m.at);
  }
}
