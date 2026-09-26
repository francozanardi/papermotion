import { Camera, Stage, circlePoly, drawRidge, fillGradient, grain, keys, type RidgeSpec, vignette, wash } from '../../src';

const W = 1920, H = 1080;
const FAR: RidgeSpec = { seed: 1, base: 640, amp: 60, freq: 0.002, color: '#c98f7a', tear: 3, shadow: 0 };
const NEAR: RidgeSpec = { seed: 2, base: 800, amp: 50, freq: 0.003, color: '#6f7d4f', tear: 3, bands: [{ offset: 70, color: '#5d6a42' }] };

/**
 * The smallest papermotion scene: a paper sun rising behind two layers of hills while the camera
 * drifts, so the parallax shows. Replace it with your own film, or keep it as a sketchpad.
 */
export class HelloScene extends Stage {
  private readonly cam = new Camera(W / 2, { width: W, height: H, handheld: 3 });

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 4 });
    this.paper.light = { x: 0.6, y: 0.7 };
  }

  protected start(): void { this.cam.cut({ x: W / 2, y: H / 2, zoom: 1.05 }); }

  protected update(): void {}

  protected lateUpdate(t: number, dt: number): void {
    this.cam.frame({ x: W / 2 + t * 60, y: H / 2, zoom: 1.05 }, dt, t);
  }

  protected draw(t: number, frame: number): void {
    const { ctx, paper, cam } = this;
    fillGradient(ctx, [[0, '#f6d7b0'], [1, '#e79a78']]);
    cam.layer(paper, 0.05, () => paper.piece(circlePoly({ x: W * 0.62, y: keys(t, [[0, 700], [4, 420]]) }, 90, 40), '#fff1d6', { seed: 3, tear: 2, shadow: 0 }));
    cam.layer(paper, 0.3, v => drawRidge(paper, FAR, v.from, v.to, v.bottom + 200));
    cam.layer(paper, 1, v => drawRidge(paper, NEAR, v.from, v.to, v.bottom + 200));
    vignette(ctx, [60, 20, 20], 0.35);
    grain(ctx, frame, 0.06);
    wash(ctx, '#000', 1 - Math.min(1, t / 0.6));
  }
}
