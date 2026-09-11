# Snake SDD

A classic Snake game in vanilla JavaScript, built as a worked example of Spec-Driven Development: every game rule lives in a pure module covered by Node's built-in test runner, and the browser code is thin wiring around it. No frameworks, no bundler, no `npm install`.

## Quick path

1. `npm test` — runs `node --test` (Node >= 20), 40 tests, nothing to install.
2. `python3 -m http.server 8000` from this folder.
3. Open <http://localhost:8000>. Press an arrow key to start; Enter or Space restarts after the game ends. The best score is kept in `localStorage`.

Opening `index.html` directly from the filesystem does not work: browsers block `<script type="module">` on `file://`. Serve it over HTTP.

## How it is built

| Module | Role | Imports |
|--------|------|---------|
| `src/core.js` | Every game rule: state, movement, collisions, growth, food spawn, win. Pure functions, no DOM, no timers. | nothing |
| `src/renderer.js` | Draws a state snapshot on a `<canvas>`, interpolating between ticks, and writes the score to an `aria-live` HUD. Colors come from CSS tokens. | constants from core |
| `src/input.js` | Maps `keydown` to direction and restart intents. Owns no rules. | constants from core |
| `src/overlay.js` | Fills and toggles the start / game-over / won panel over the board. | nothing |
| `src/highScore.js` | Best-score persistence over the Web Storage shape, with an in-memory fallback. | nothing |
| `src/main.js` | Wires everything; `setInterval` at 150 ms simulates, `requestAnimationFrame` renders; restarts only from a terminal state. | core, renderer, input, overlay, highScore |
| `src/styles.css` | Design tokens (light/dark), layout, and the animation hooks toggled by `main.js`. | — |
| `test/core.test.js` | `node:test` suite for the core, one `describe` per requirement (`CORE-01`..`CORE-15`). | core |
| `test/highScore.test.js` | `node:test` suite for `highScore` against a fake storage. | highScore |

Rules worth knowing before changing the core:

- Grid is a fixed 20x20 (`GRID_SIZE`). The snake starts centered with length 3 moving right.
- The reversal guard compares against the last **applied** direction, so two quick inputs in one tick cannot turn the snake back on itself.
- Moving into the cell the tail is vacating this tick is not a collision.
- Eating keeps the tail that tick (growth), adds one to the score, and picks a new free cell. When no free cell remains, status becomes `won` and `food` is `null`.
- Randomness enters only through an injectable `random()` in `[0, 1)`; tests pin cells with `(k + 0.5) / n`.

## Delivery history

The change was delivered as five reviewable slices, each under 400 changed lines:

```
main
 └─ feature/snake-game-core
     ├─ snake-game-core/01-setup              build(project): esm manifest and test scaffold
     ├─ snake-game-core/02-core-fundamentals  feat(core): initial state, movement, direction, reversal guard
     ├─ snake-game-core/03-core-collisions    feat(core): wall/self collision, growth on eating
     ├─ snake-game-core/04-core-terminal      feat(core): won transition, terminal no-op, purity
     └─ snake-game-core/05-browser-shell      feat(ui): canvas renderer, keyboard input, game loop
```

The planning artifacts (proposal, spec with 28 requirements and 34 scenarios, design, tasks, verification, archive) were produced with Gentle AI SDD and live in Engram memory rather than in this repository.

## Manual checklist (browser play-test)

No `node --test` coverage exists for canvas/DOM behavior; verify these by playing the game in a served browser. Numbering continues the `snake-levels` change's checklist (MC01-MC12 predate this repo).

- [ ] MC13 — Press lowercase `w`/`a`/`s`/`d`: the snake turns up/left/down/right exactly like the arrow keys.
- [ ] MC14 — Press uppercase `W`/`A`/`S`/`D` (Shift or CapsLock on): the same turns still register, and the reversal guard still blocks turning back on itself.
- [ ] MC15 — At score 5 (level 2), two wall tiles appear on the board; never inside the snake, never in the 3 cells directly ahead of the head, and they persist unchanged across ticks until game over or restart.
- [ ] MC16 — Steering the head into a wall tile ends the game exactly like a self-collision: game-over overlay, board shake.
- [ ] MC17 — As the score crosses level boundaries, the tick visibly speeds up; speed stops increasing once the level reaches 16 (60 ms/tick floor).
- [ ] MC18 — From level 8 onward, some food renders as a hollow ring with a center bar (not the solid disc); eating it shrinks the snake by 2 segments (never below length 3) and leaves score/level unchanged.
- [ ] Walls and the negative-apple ring are visually distinguishable from the snake and normal food in both light and dark color schemes.

## Checklist for contributors

- [ ] `npm test` passes and every new core rule has a failing test before its implementation.
- [ ] `src/core.js` still references no browser API; `Math.random` appears only as a default parameter.
- [ ] `renderer.js`, `input.js`, `overlay.js`, `highScore.js` and `main.js` contain no game rule.
- [ ] The renderer never sets `canvas.style.width/height`; CSS owns the displayed size (`aspect-ratio: 1`).
- [ ] The game was played once in a served browser after touching any browser module.

## Out of scope

Levels, progressive speed, sound, touch controls.
