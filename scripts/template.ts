/**
 * Build the project template that `npm create papermotion` copies: the engine, the tools, the tests,
 * the agent skill and the field notes, plus a minimal starter scene. The reference shorts in
 * `examples/` are left out on purpose, so agents in a new project invent their own work instead of
 * borrowing from them.
 *
 *   pnpm template [dir]   → packages/create-papermotion/template (default)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STARTER = join(ROOT, 'packages', 'create-papermotion', 'starter');

/** Repo paths copied as they are. */
const COPY = [
  'src', 'scripts', 'tests', '.claude/skills', '.agents/skills', 'docs/field-notes.md',
  'index.html', 'vite.config.ts', 'tsconfig.json', 'pnpm-lock.yaml', 'examples/play.ts',
];
/** Repo files that only make sense here (building and publishing the template itself). */
const SKIP = ['scripts/template.ts', 'tests/template.test.ts'];

export function buildTemplate(out: string): void {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const path of COPY) {
    if (!existsSync(join(ROOT, path))) continue;
    cpSync(join(ROOT, path), join(out, path), { recursive: true, filter: src => !SKIP.includes(relative(ROOT, src)) });
  }
  cpSync(STARTER, out, { recursive: true });
  // The engine's license travels with the engine; the new project's own license is its author's call.
  cpSync(join(ROOT, 'LICENSE'), join(out, 'src', 'LICENSE'));
  // npm drops .gitignore files from packages, so it travels as _gitignore and the CLI renames it.
  writeFileSync(join(out, '_gitignore'), readFileSync(join(ROOT, '.gitignore'), 'utf8'));

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  delete pkg.scripts.template;
  const version = JSON.parse(readFileSync(join(ROOT, 'packages', 'create-papermotion', 'package.json'), 'utf8')).version;
  writeFileSync(join(out, 'package.json'), `${JSON.stringify({
    name: 'my-papermotion', version: '0.0.0', private: true, type: 'module',
    description: `Short films made with papermotion ${version}.`, papermotion: version,
    scripts: pkg.scripts, devDependencies: pkg.devDependencies,
  }, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = resolve(process.argv[2] ?? join(ROOT, 'packages', 'create-papermotion', 'template'));
  buildTemplate(out);
  console.log(`template → ${relative(process.cwd(), out) || '.'}`);
}
