import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTemplate } from '../scripts/template';

const out = mkdtempSync(join(tmpdir(), 'papermotion-template-'));
buildTemplate(out);
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('project template', () => {
  it('ships the engine, tools, tests, skill and a starter scene', () => {
    for (const path of ['src/index.ts', 'src/LICENSE', 'scripts/render.ts', 'tests', '.claude/skills/papermotion/SKILL.md', '.agents/skills/papermotion/SKILL.md',
      'docs/field-notes.md', 'examples/catalog.ts', 'examples/play.ts', 'examples/hello/main.ts', 'AGENTS.md', 'README.md', '_gitignore']) {
      expect(existsSync(join(out, path)), path).toBe(true);
    }
  });

  it('leaves the reference shorts and the template tooling out', () => {
    expect(readdirSync(join(out, 'examples')).sort()).toEqual(['catalog.ts', 'hello', 'play.ts']);
    expect(existsSync(join(out, 'scripts/template.ts'))).toBe(false);
    expect(existsSync(join(out, 'tests/template.test.ts'))).toBe(false);
  });

  it('has a package.json with the tools and no template script', () => {
    const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8'));
    expect(pkg.scripts.render).toBeDefined();
    expect(pkg.scripts.template).toBeUndefined();
    expect(pkg.papermotion).toMatch(/^\d+\.\d+\.\d+/);
  });
});
