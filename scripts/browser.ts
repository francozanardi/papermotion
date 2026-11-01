/** Shared by the render and inspection scripts: a Vite server and a headless Chromium on an example. */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type Browser, type Page, chromium } from 'playwright-core';
import { type ViteDevServer, createServer } from 'vite';

/** The host facts a lookup depends on; every field defaults to the real machine. */
export interface ChromiumLookup {
  platform?: string;
  arch?: string;
  env?: Record<string, string | undefined>;
  home?: string;
  exists?: (path: string) => boolean;
  readdir?: (path: string) => string[];
}

type ResolvedLookup = Required<ChromiumLookup>;

/** Where Playwright keeps its browsers, by platform. `PLAYWRIGHT_BROWSERS_PATH` wins when set. */
function cacheRoots(o: ResolvedLookup): string[] {
  const roots: string[] = [];
  if (o.env.PLAYWRIGHT_BROWSERS_PATH) roots.push(o.env.PLAYWRIGHT_BROWSERS_PATH);
  if (o.platform === 'darwin') roots.push(join(o.home, 'Library', 'Caches', 'ms-playwright'));
  else if (o.platform === 'win32') roots.push(join(o.env.LOCALAPPDATA ?? join(o.home, 'AppData', 'Local'), 'ms-playwright'));
  else roots.push(join(o.env.XDG_CACHE_HOME ?? join(o.home, '.cache'), 'ms-playwright'));
  return roots;
}

/**
 * The executable inside a `chromium-<build>` directory, relative to it.
 * Playwright renamed the macOS bundle from Chromium to Chrome for Testing and
 * splits it per architecture, so the running arch is tried before the other one.
 */
function candidates(o: ResolvedLookup): string[] {
  if (o.platform === 'darwin') {
    const mac = (arch: string) => [
      `chrome-mac-${arch}/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
      `chrome-mac-${arch}/Chromium.app/Contents/MacOS/Chromium`,
    ];
    const own = o.arch === 'arm64' ? mac('arm64') : mac('x64');
    const other = o.arch === 'arm64' ? mac('x64') : mac('arm64');
    return [...own, ...other, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'];
  }
  if (o.platform === 'win32') return ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'];
  return ['chrome-linux64/chrome', 'chrome-linux/chrome'];
}

/** The build number in a `chromium-<build>` directory name, or -1 for anything else. */
function build(dir: string): number {
  const n = Number(dir.replace('chromium-', ''));
  return Number.isInteger(n) ? n : -1;
}

/** Path to a Playwright-installed Chromium: `CHROMIUM_PATH` if set, else the newest build in the cache. */
export function findChromium(lookup: ChromiumLookup = {}): string {
  const o: ResolvedLookup = {
    platform: lookup.platform ?? process.platform,
    arch: lookup.arch ?? process.arch,
    env: lookup.env ?? process.env,
    home: lookup.home ?? homedir(),
    exists: lookup.exists ?? existsSync,
    readdir: lookup.readdir ?? readdirSync,
  };
  if (o.env.CHROMIUM_PATH) return o.env.CHROMIUM_PATH;
  const exes = candidates(o);
  for (const root of cacheRoots(o)) {
    if (!o.exists(root)) continue;
    const builds = o.readdir(root).filter(d => d.startsWith('chromium-') && build(d) >= 0).sort((a, b) => build(b) - build(a));
    for (const b of builds) {
      for (const exe of exes) {
        const bin = join(root, b, exe);
        if (o.exists(bin)) return bin;
      }
    }
  }
  throw new Error('No Chromium found: run `npx playwright install chromium` or set CHROMIUM_PATH.');
}

export interface Session {
  server: ViteDevServer; browser: Browser; page: Page; base: string;
  /** Another page in its own browser context, so it gets its own renderer process (and CPU core). */
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

const viewport = { width: 1920, height: 1080 };

export async function open(): Promise<Session> {
  // No HMR and no file watching: editing sources while a script runs must not reload the page.
  const server = await createServer({ server: { port: 0, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  const base = server.resolvedUrls!.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: findChromium() });
  const newPage = async () => (await browser.newContext({ viewport })).newPage();
  const page = await newPage();
  return { server, browser, page, base, newPage, close: async () => { await browser.close(); await server.close(); } };
}

/** Load an example paused, ready for `frame(n)` / `probe(n)`; throws on page errors. `scale` < 1 loads a draft. */
export async function load(page: Page, base: string, name: string, errors: string[], scale = 1): Promise<{ fps: number; frames: number }> {
  page.removeAllListeners('pageerror');
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?example=${name}&headless${scale !== 1 ? `&scale=${scale}` : ''}`);
  await page.waitForFunction(() => (globalThis as { ready?: boolean }).ready || document.querySelector('p'), null, { timeout: 60_000 });
  if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
  const meta = await page.evaluate(() => (globalThis as unknown as { meta?: { fps: number; frames: number } }).meta);
  if (!meta) throw new Error(`${name}: the page did not mount a stage (${await page.textContent('p')})`);
  return meta;
}
