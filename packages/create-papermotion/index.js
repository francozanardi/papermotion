#!/usr/bin/env node
/**
 * npm create papermotion [dir]
 *
 * Copies the papermotion template into a new folder: the engine (yours to extend), the render and
 * inspection tools, the tests, the agent skill and a starter scene. No reference shorts are included.
 */
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const template = join(dirname(fileURLToPath(import.meta.url)), 'template');
const arg = process.argv.slice(2).find(a => !a.startsWith('-'));
const target = resolve(arg ?? 'my-papermotion');

if (!existsSync(template)) fail('The template is missing from this package (it is built when the package is packed).');
if (existsSync(target) && readdirSync(target).length) fail(`${relative(process.cwd(), target) || '.'} already exists and is not empty.`);

cpSync(template, target, { recursive: true });
renameSync(join(target, '_gitignore'), join(target, '.gitignore'));
const pkgPath = join(target, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = basename(target).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+/, '') || 'my-papermotion';
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const agent = process.env.npm_config_user_agent ?? '';
const pm = agent.startsWith('pnpm') ? 'pnpm' : agent.startsWith('yarn') ? 'yarn' : agent.startsWith('bun') ? 'bun' : 'npm';
const run = pm === 'npm' ? 'npm run' : pm;
const rel = relative(process.cwd(), target) || '.', dir = rel.includes(' ') ? `"${rel}"` : rel;
console.log(`
papermotion ${pkg.papermotion} → ${dir}

Next:
  cd ${dir}
  ${pm} install
  npx playwright-core install chromium   # the headless browser that renders frames (also needs ffmpeg)
  ${run} render hello                     # → out/hello.mp4

Then open the folder with your coding agent and ask for a film with the skill. In Claude Code:

  /papermotion make a 10-second short about a paper boat caught in the rain

Other agents: "Use the papermotion skill (.agents/skills/papermotion) to make a 20-second short
about a paper boat caught in the rain."
`);

function fail(message) {
  console.error(`create-papermotion: ${message}`);
  process.exit(1);
}
