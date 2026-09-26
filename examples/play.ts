import { mount } from '../src';
import { EXAMPLES } from './catalog';

/**
 * ?example=<name>            play the rendered video (out/<name>.mp4, made by `pnpm render <name>`)
 * ?example=<name>&live       run the scene live in the browser (quick iteration; may stutter on heavy scenes)
 * ?example=<name>&headless   live but paused: frames are pulled through window.frame(n) (used by the renderer)
 */
const params = new URLSearchParams(location.search);
const name = params.get('example') ?? Object.keys(EXAMPLES)[0];
const canvas = document.getElementById('stage') as HTMLCanvasElement;

if (!EXAMPLES[name]) {
  showMessage(`Unknown example "${name}". Try: ${Object.keys(EXAMPLES).join(', ')}.`);
} else if (params.has('live') || params.has('headless')) {
  const make = await EXAMPLES[name]();
  await Promise.all(['300 64px Montserrat', '800 64px Montserrat'].map(f => document.fonts.load(f)));
  mount(canvas, c => make(c, params), { headless: params.has('headless') });
} else {
  playVideo(`/out/${name}.mp4`);
}

function playVideo(src: string): void {
  const video = document.createElement('video');
  Object.assign(video, { src: `${src}?t=${Date.now()}`, autoplay: true, loop: true, muted: true, controls: true, playsInline: true });
  video.onerror = () => showMessage(`No render yet for "${name}". Run <code>pnpm render ${name}</code>, or open it <a href="?example=${name}&live">live</a>.`);
  canvas.replaceWith(video);
}

function showMessage(html: string): void {
  const p = document.createElement('p');
  p.innerHTML = html;
  document.querySelector('#stage, video')?.replaceWith(p);
}
