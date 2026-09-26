/** Shared by the render and inspection scripts: a Vite server and a headless Chromium on an example. */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type Browser, type Page, chromium } from 'playwright-core';
import { type ViteDevServer, createServer } from 'vite';

export function findChromium(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const builds = existsSync(cache) ? readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().reverse() : [];
  for (const b of builds) {
    const bin = join(cache, b, 'chrome-linux64', 'chrome');
    if (existsSync(bin)) return bin;
  }
  throw new Error('No Chromium found: run `npx playwright install chromium` or set CHROMIUM_PATH.');
}

export interface Session { server: ViteDevServer; browser: Browser; page: Page; base: string; close(): Promise<void> }

export async function open(): Promise<Session> {
  // No HMR and no file watching: editing sources while a script runs must not reload the page.
  const server = await createServer({ server: { port: 0, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  const base = server.resolvedUrls!.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: findChromium() });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  return { server, browser, page, base, close: async () => { await browser.close(); await server.close(); } };
}

/** Load an example paused, ready for `frame(n)` / `probe(n)`; throws on page errors. */
export async function load(page: Page, base: string, name: string, errors: string[]): Promise<{ fps: number; frames: number }> {
  page.removeAllListeners('pageerror');
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?example=${name}&headless`);
  await page.waitForFunction(() => (globalThis as { ready?: boolean }).ready || document.querySelector('p'), null, { timeout: 60_000 });
  if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
  const meta = await page.evaluate(() => (globalThis as unknown as { meta?: { fps: number; frames: number } }).meta);
  if (!meta) throw new Error(`${name}: the page did not mount a stage (${await page.textContent('p')})`);
  return meta;
}
