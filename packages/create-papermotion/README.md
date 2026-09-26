# create-papermotion

Start a [papermotion](https://github.com/francozanardi/papermotion) project: a paper-cutout animation
engine that AI agents use, and extend, to make short films entirely in code.

```bash
npm create papermotion@latest my-films
cd my-films
pnpm install
npx playwright-core install chromium   # headless browser for rendering (you also need ffmpeg)
pnpm render hello                       # → out/hello.mp4
```

The new project holds its own copy of the engine, the render and inspection tools, the tests, a
starter scene and the agent skill (`.claude/skills/papermotion`, `.agents/skills/papermotion`). Open it
with your coding agent and ask for a film, e.g. in Claude Code:

```text
/papermotion make a 10-second short about a paper boat caught in the rain
```

Experimental, and made entirely with AI. MIT licensed.
