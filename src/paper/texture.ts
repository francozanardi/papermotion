import { rng } from '../core/random';

/** Procedural paper: mottled base, fibers and specks. */
export function makeTexture(size: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const shade = 100 + r() * 60;
    g.fillStyle = `rgba(${shade},${shade},${shade},0.08)`;
    g.beginPath();
    g.arc(r() * size, r() * size, 6 + r() * 26, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 1400; i++) {
    const light = r() > 0.5;
    g.strokeStyle = light ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
    g.lineWidth = 0.6 + r() * 0.8;
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 3 + r() * 12;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
    g.fillRect(r() * size, r() * size, 1, 1);
  }
  return c;
}
