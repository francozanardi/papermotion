import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findChromium } from '../scripts/browser';

/**
 * A fake filesystem: `dirs` maps a directory to the names it lists, `files` marks
 * which paths exist as executables. Nothing touches the real disk.
 */
function fsOf(dirs: Record<string, string[]> = {}, files: string[] = []) {
  const fileSet = new Set(files);
  return {
    exists: (path: string) => path in dirs || fileSet.has(path),
    readdir: (path: string) => {
      if (!(path in dirs)) throw new Error(`ENOENT: no such directory ${path}`);
      return dirs[path];
    },
  };
}

const home = '/home/owen';
const linuxRoot = join(home, '.cache', 'ms-playwright');
const macRoot = join(home, 'Library', 'Caches', 'ms-playwright');
const macChromeTesting = (arch: string) => `chrome-mac-${arch}/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

describe('findChromium', () => {
  it('uses CHROMIUM_PATH as given, without looking at the cache', () => {
    const fs = fsOf({ [linuxRoot]: ['chromium-1243'] });
    expect(findChromium({ platform: 'linux', env: { CHROMIUM_PATH: '/opt/chrome' }, home, ...fs })).toBe('/opt/chrome');
  });

  it('finds the Linux cache under ~/.cache', () => {
    const bin = join(linuxRoot, 'chromium-1243', 'chrome-linux64', 'chrome');
    const fs = fsOf({ [linuxRoot]: ['chromium-1243'], [join(linuxRoot, 'chromium-1243')]: ['chrome-linux64'] }, [bin]);
    expect(findChromium({ platform: 'linux', env: {}, home, ...fs })).toBe(bin);
  });

  it('honours XDG_CACHE_HOME on Linux', () => {
    const root = '/cache/ms-playwright';
    const bin = join(root, 'chromium-1243', 'chrome-linux64', 'chrome');
    const fs = fsOf({ [root]: ['chromium-1243'], [join(root, 'chromium-1243')]: ['chrome-linux64'] }, [bin]);
    expect(findChromium({ platform: 'linux', env: { XDG_CACHE_HOME: '/cache' }, home, ...fs })).toBe(bin);
  });

  it('finds the macOS Chrome for Testing bundle Playwright ships today', () => {
    const bin = join(macRoot, 'chromium-1243', macChromeTesting('arm64'));
    const fs = fsOf({ [macRoot]: ['chromium-1243'], [join(macRoot, 'chromium-1243')]: ['chrome-mac-arm64'] }, [bin]);
    expect(findChromium({ platform: 'darwin', arch: 'arm64', env: {}, home, ...fs })).toBe(bin);
  });

  it('tries the running macOS architecture first, then the other one', () => {
    const arm64 = join(macRoot, 'chromium-1243', macChromeTesting('arm64'));
    const x64 = join(macRoot, 'chromium-1243', macChromeTesting('x64'));
    const both = fsOf({ [macRoot]: ['chromium-1243'], [join(macRoot, 'chromium-1243')]: ['chrome-mac-arm64', 'chrome-mac-x64'] }, [arm64, x64]);
    expect(findChromium({ platform: 'darwin', arch: 'arm64', env: {}, home, ...both })).toBe(arm64);
    expect(findChromium({ platform: 'darwin', arch: 'x64', env: {}, home, ...both })).toBe(x64);

    const armOnly = fsOf({ [macRoot]: ['chromium-1243'], [join(macRoot, 'chromium-1243')]: ['chrome-mac-arm64'] }, [arm64]);
    expect(findChromium({ platform: 'darwin', arch: 'x64', env: {}, home, ...armOnly })).toBe(arm64);
  });

  it('still accepts the older macOS Chromium.app layout', () => {
    const bin = join(macRoot, 'chromium-1194', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
    const fs = fsOf({ [macRoot]: ['chromium-1194'], [join(macRoot, 'chromium-1194')]: ['chrome-mac'] }, [bin]);
    expect(findChromium({ platform: 'darwin', arch: 'arm64', env: {}, home, ...fs })).toBe(bin);
  });

  it('finds the Windows cache under LOCALAPPDATA', () => {
    const local = join('C:', 'Users', 'owen', 'AppData', 'Local');
    const root = join(local, 'ms-playwright');
    const bin = join(root, 'chromium-1243', 'chrome-win64', 'chrome.exe');
    const fs = fsOf({ [root]: ['chromium-1243'], [join(root, 'chromium-1243')]: ['chrome-win64'] }, [bin]);
    expect(findChromium({ platform: 'win32', env: { LOCALAPPDATA: local }, home: join('C:', 'Users', 'owen'), ...fs })).toBe(bin);
  });

  it('prefers the newest build by number, not by string order', () => {
    const old = join(linuxRoot, 'chromium-999', 'chrome-linux64', 'chrome');
    const recent = join(linuxRoot, 'chromium-1243', 'chrome-linux64', 'chrome');
    const fs = fsOf({
      [linuxRoot]: ['chromium-999', 'chromium-1243'],
      [join(linuxRoot, 'chromium-999')]: ['chrome-linux64'],
      [join(linuxRoot, 'chromium-1243')]: ['chrome-linux64'],
    }, [old, recent]);
    expect(findChromium({ platform: 'linux', env: {}, home, ...fs })).toBe(recent);
  });

  it('falls back to an older build when the newest one is incomplete', () => {
    const bin = join(linuxRoot, 'chromium-1194', 'chrome-linux64', 'chrome');
    const fs = fsOf({
      [linuxRoot]: ['chromium-1243', 'chromium-1194'],
      [join(linuxRoot, 'chromium-1243')]: ['INSTALLATION_COMPLETE'],
      [join(linuxRoot, 'chromium-1194')]: ['chrome-linux64'],
    }, [bin]);
    expect(findChromium({ platform: 'linux', env: {}, home, ...fs })).toBe(bin);
  });

  it('ignores directories that are not chromium builds', () => {
    const bin = join(linuxRoot, 'chromium-1243', 'chrome-linux64', 'chrome');
    const decoys = ['chromium_headless_shell-1243', 'ffmpeg-1011', 'chromium-latest'];
    const fs = fsOf({
      [linuxRoot]: [...decoys, 'chromium-1243'],
      ...Object.fromEntries(decoys.map(d => [join(linuxRoot, d), ['chrome-linux64']])),
      [join(linuxRoot, 'chromium-1243')]: ['chrome-linux64'],
    }, [bin]);
    expect(findChromium({ platform: 'linux', env: {}, home, ...fs })).toBe(bin);
  });

  it('honours PLAYWRIGHT_BROWSERS_PATH over the platform default', () => {
    const custom = join('/custom/browsers', 'chromium-1243', 'chrome-linux64', 'chrome');
    const fs = fsOf({
      '/custom/browsers': ['chromium-1243'],
      [join('/custom/browsers', 'chromium-1243')]: ['chrome-linux64'],
      [linuxRoot]: ['chromium-1194'],
      [join(linuxRoot, 'chromium-1194')]: ['chrome-linux64'],
    }, [custom, join(linuxRoot, 'chromium-1194', 'chrome-linux64', 'chrome')]);
    expect(findChromium({ platform: 'linux', env: { PLAYWRIGHT_BROWSERS_PATH: '/custom/browsers' }, home, ...fs })).toBe(custom);
  });

  it('explains how to fix it when no browser is installed', () => {
    const empty = fsOf({ [linuxRoot]: [] });
    expect(() => findChromium({ platform: 'linux', env: {}, home, ...empty }))
      .toThrow(/npx playwright install chromium.*CHROMIUM_PATH/);
    expect(() => findChromium({ platform: 'darwin', env: {}, home, exists: () => false, readdir: () => [] }))
      .toThrow(/No Chromium found/);
  });
});
