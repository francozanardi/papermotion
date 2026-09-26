import { Spring } from '../core/Spring';
import { clamp, type V } from '../core/math';
import { noise1 } from '../core/random';
import type { Paper } from '../paper/Paper';
import { Particles } from './Particles';

/** Dimensions and deterministic emission seed for a paper flame. */
export interface FireOpts {
  seed: number;
  width: number;
  height: number;
  /** Embers emitted per second at full strength. */
  sparks?: number;
}

/** Spring-driven flame tongues, rising smoke and embers; independent of fuel or story props. */
export class Fire {
  private readonly energy = new Spring({ x: 0.7, y: 0 }, 28, 9);
  private readonly tongues = Array.from({ length: 7 }, () => new Spring({ x: 0, y: 0.6 }, 105, 13));
  private wind = 0;
  private sparkCredit = 0;
  private smokeCredit = 0;
  readonly embers: Particles;
  private readonly smoke: Particles;

  constructor(readonly at: V, private readonly o: FireOpts) {
    this.embers = new Particles({ seed: o.seed, gravity: -15, drag: 0.3, flow: () => ({ x: this.wind * 65, y: -35 }) });
    this.smoke = new Particles({ seed: o.seed + 91, gravity: -8, drag: 0.4, flow: () => ({ x: this.wind * 45, y: -50 }) });
  }

  /** Smoothed heat, suitable for driving light or sound levels. */
  get heat(): number { return Math.max(0, this.energy.pos.x); }

  /** Current tongue tips in world coordinates, for attachment or inspection. */
  get tips(): V[] {
    return this.tongues.map((s, i) => {
      const height = Math.max(0, s.pos.y) * this.o.height;
      // A dying flame must lose lateral reach with height, rather than fold into a horizontal strip.
      const reach = height * 0.65;
      const lean = reach > 0 ? Math.tanh(s.pos.x * this.o.width / reach) * reach : 0;
      return { x: this.base(i) + lean, y: this.at.y - height };
    });
  }

  private base(i: number): number {
    return this.at.x + (i - 3) * this.o.width / 9 * Math.sqrt(Math.min(1, this.heat));
  }

  /** Advance at a fixed timestep; intensity is 0…1.5 and wind is signed. */
  update(dt: number, t: number, intensity = 1, wind = 0): void {
    this.wind = wind;
    this.energy.step({ x: clamp(intensity, 0, 1.5), y: 0 }, dt);
    this.tongues.forEach((s, i) => {
      const h = this.heat * (0.65 + 0.3 * noise1(t * 3.3 + i * 5, this.o.seed + i));
      s.step({ x: wind * 0.30 + noise1(t * 2.8 + i * 9, this.o.seed + 8) * 0.24, y: h * (1 - Math.abs(i - 3) * 0.09) }, dt);
    });
    this.sparkCredit += dt * (this.o.sparks ?? 12) * this.heat;
    const sparks = Math.floor(this.sparkCredit); this.sparkCredit -= sparks;
    if (sparks) this.embers.emit({ x: this.at.x, y: this.at.y - this.o.height * this.heat * 0.3 }, sparks, { angle: -Math.PI / 2, spread: 0.7, speed: [35, 130], life: [1.5, 5], size: [1, 3], carry: { x: wind * 40, y: 0 } });
    this.smokeCredit += dt * 3 * this.heat;
    const clouds = Math.floor(this.smokeCredit); this.smokeCredit -= clouds;
    if (clouds) this.smoke.emit({ x: this.at.x, y: this.at.y - this.o.height * this.heat * 0.65 }, clouds, { angle: -Math.PI / 2, spread: 0.2, speed: [20, 35], life: [3, 5], size: [10, 21] });
    this.embers.update(dt); this.smoke.update(dt);
  }

  /** Cast warm screen-blended light in the current paper coordinate system. */
  glow(p: Paper, radius = this.o.height * 2.6): void {
    const c = p.context, at = this.at;
    c.save(); c.globalCompositeOperation = 'screen';
    const g = c.createRadialGradient(at.x, at.y - 40, 0, at.x, at.y - 40, radius);
    g.addColorStop(0, `rgba(255,146,56,${0.32 * this.heat})`);
    g.addColorStop(0.35, `rgba(197,74,38,${0.12 * this.heat})`);
    g.addColorStop(1, 'rgba(105,47,35,0)');
    c.fillStyle = g; c.fillRect(at.x - radius, at.y - radius - 40, radius * 2, radius * 2); c.restore();
  }

  /** Draw smoke, layered cut-paper flames and emissive sparks. */
  draw(p: Paper): void {
    this.smoke.draw((s, u) => {
      const c = p.context; c.save(); c.globalAlpha = Math.sin(u * Math.PI) * 0.025;
      p.ribbon([{ x: s.x - 14 * u, y: s.y + 25 }, { x: s.x + 22 * u, y: s.y }, { x: s.x - 24 * u, y: s.y - 55 * u }], v => s.size * (1 + u * 2) * Math.sin(v * Math.PI), '#baacb1', { seed: Math.floor(s.seed * 999), tear: 2, shadow: 0, edge: false, texture: 0 }); c.restore();
    });
    const tips = this.tips;
    for (let layer = 0; layer < 3; layer++) {
      p.sheet({ shadow: 0, edge: false, texture: 0.14, anchor: this.at }, () => {
        for (let i = 0; i < 7; i++) {
          const scale = 1 - layer * 0.24, base = this.base(i);
          const h = (this.at.y - tips[i].y) * scale;
          const w = Math.min(this.o.width * (0.22 - layer * 0.035) * Math.sqrt(this.heat), h * 0.42);
          if (h < 0.2) continue;
          const tip = { x: base + (tips[i].x - base) * scale, y: this.at.y - h };
          p.blob([{ x: base - w, y: this.at.y }, { x: base - w * 0.8, y: this.at.y - h * 0.38 }, { x: tip.x - w * 0.2, y: tip.y + h * 0.27 }, tip, { x: tip.x + w * 0.3, y: tip.y + h * 0.35 }, { x: base + w, y: this.at.y }], ['#da5637', '#ffac4f', '#ffe6a2'][layer], { seed: this.o.seed + i, tear: Math.min(0.5, h * 0.015) });
        }
      });
    }
    this.embers.draw((s, u) => {
      const c = p.context; c.save(); c.globalAlpha = Math.min(1, (1 - u) * 2);
      p.line([{ x: s.x - s.vx * 0.012, y: s.y - s.vy * 0.012 }, s], u < 0.4 ? '#ffe0a0' : '#de7950', s.size); c.restore();
    });
  }
}
