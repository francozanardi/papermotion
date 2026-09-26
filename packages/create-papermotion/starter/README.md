# My papermotion films

Short films made in code with [papermotion](https://github.com/francozanardi/papermotion), a
paper-cutout animation engine built for AI agents.

```bash
pnpm install
npx playwright-core install chromium   # the headless browser that renders frames (also needs ffmpeg)
pnpm render hello                       # → out/hello.mp4
```

Open this folder with your coding agent and ask for a film with the skill. In Claude Code:

```text
/papermotion make a 10-second short about a paper boat caught in the rain
```

Other agents can use the same skill from `.agents/skills/papermotion`: *"Use the papermotion skill to
make a 10-second short about a paper boat caught in the rain."* The agent writes the scene in `examples/`, extends the engine in
`src/` when it needs something new, renders it and checks the frames.

| Folder | What it is |
| --- | --- |
| `src/` | The engine: paper rendering, rigs, physics, camera, choreography, sound. It's your copy; change it. |
| `examples/` | Your scenes, registered in `examples/catalog.ts`. `hello` is a starter to replace. |
| `scripts/` | Offline render, frame grabs, contact sheets, the sound inspector. |
| `tests/` | Engine tests (`pnpm test`). |
| `docs/field-notes.md` | Lessons learned making films with the engine. |

The engine in `src/` is licensed under MIT (see `src/LICENSE`).
