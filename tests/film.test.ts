import { describe, expect, it } from 'vitest';
import { Camera, Edit, Particles, Spool, Strand, World, speedRamp } from '../src';

const DT = 1 / 60;

describe('Spool', () => {
  it('pays out line behind a moving source without pulling it back', () => {
    const world = new World();
    world.ground = () => 100;
    let x = 0;
    const spool = new Spool(world, { x: 0, y: 0 }, () => ({ x, y: 50 }), { segment: 10, mass: 0.02, friction: 0.9 });
    for (let i = 0; i < 300; i++) { x += 3; spool.update(); world.step(DT, i * DT); }
    expect(spool.paid).toBeGreaterThan(850);
    expect(spool.pts.length).toBeGreaterThan(80);
    const last = spool.pts[spool.pts.length - 1];
    expect(last.x).toBeCloseTo(900, 0);
    // The line lies on the ground behind the source.
    expect(spool.pts[spool.pts.length / 2 | 0].y).toBeCloseTo(100, 0);
  });
});

describe('Edit', () => {
  it('cuts on a condition, snapping the camera; eases within a shot', () => {
    let fell = false;
    const cam = new Camera(0, { width: 100, height: 100 });
    const edit = new Edit<'wide' | 'close'>('wide', {
      wide: { frame: ({ since }) => ({ x: since * 100, y: 50, zoom: 0.5 }), next: () => fell && 'close' },
      close: { frame: () => ({ x: 500, y: 20, zoom: 4 }) },
    });
    let t = 0;
    for (; t < 1; t += DT) { edit.update(t, DT); edit.apply(cam, t, DT); }
    expect(edit.current).toBe('wide');
    expect(cam.zoom).toBeCloseTo(0.5);
    fell = true;
    edit.update(t, DT); edit.apply(cam, t, DT);
    expect(edit.current).toBe('close');
    expect(cam.zoom).toBe(4);
    expect(edit.startOf('close')).toBeCloseTo(t);
  });
});

describe('speedRamp', () => {
  it('slows down inside a window and eases back to real time', () => {
    const rate = speedRamp([{ from: 2, to: 3, rate: 0.25 }], 0.2);
    expect(rate(1)).toBe(1);
    expect(rate(2.5)).toBeCloseTo(0.25);
    expect(rate(1.9)).toBeGreaterThan(0.25);
    expect(rate(1.9)).toBeLessThan(1);
    expect(rate(3.5)).toBe(1);
  });
});

describe('Particles', () => {
  it('are deterministic and land on the floor', () => {
    const run = () => {
      const p = new Particles({ seed: 3, gravity: 1000, drag: 0.5, floor: () => 0 });
      p.emit({ x: 0, y: -10 }, 20, { angle: -Math.PI / 2, spread: 1, speed: [100, 300], life: [5, 6], size: [1, 2] });
      for (let i = 0; i < 120; i++) p.update(DT);
      return p.list.map(q => [q.x, q.y, q.landed]);
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.every(([, y, landed]) => landed && y === 0)).toBe(true);
  });
});

describe('Strand.flex', () => {
  it('scales the resistance to folding, so a strand can go limp like wet cloth', () => {
    const world = new World();
    const rest = [0, 1, 2, 3, 4].map(i => ({ x: i * 10, y: 0 }));
    const s = new Strand(world, () => (p => p), rest, { hold: 0, drag: 0.02, bend: 0.6 });
    const bends = world.links.filter(l => Math.abs(l.len - 20) < 1e-6);
    expect(bends).toHaveLength(3);
    s.flex = 0.1;
    expect(bends.every(l => Math.abs(l.stiff - 0.06) < 1e-9)).toBe(true);
    s.flex = 1;
    expect(bends.every(l => l.stiff === 0.6)).toBe(true);
  });
});
