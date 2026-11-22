# CLAUDE.md

Guidance for Claude Code when working on **Shanty Boat**, a mobile-first isometric survival game.

## Workflow rules

- **Always commit and push to `main` after every change.** The repo is the rollback mechanism and there are no real users yet.
- Pushing to `main` deploys: a Cloudflare Worker linked to this GitHub repo serves the game at
  https://shantyboat.o-vertman.workers.dev/. After pushing, check the live site loads the new version.
- Keep the README's level table and feature list in sync with the game.

## Project layout

- `index.html` — HTML HUD, CSS, and the main classic `<script>`: all game logic, Web Audio, the intro film, and the 2D overlay
  (mini map, floating text, joystick, low-health flashes) drawn on the transparent `#game` canvas. No build step.
- `world3d.js` — ES module that draws the world in 3D with three.js (three@0.160.0 from jsdelivr via the import map in `index.html`;
  Water and Sky from three's examples). It reads the game's globals every frame and never changes game state.
- `models/` — Kenney CC0 packs (GLB + `Textures/colormap.png` + `License.txt` per pack), trimmed to the models in use.
  Only download new packs with the user's OK.
- `manifest.webmanifest` — web app manifest (`display: fullscreen`, portrait) for home-screen installs.
- `.claude/launch.json` — static dev server (`python -m http.server 8765`) for previewing.
- `README.md` — player-facing description and level table.

## Running and testing

- Serve the folder (`python -m http.server 8765`) and open `http://localhost:8765`. Test at phone size (375×812).
- Syntax check: extract the `<script>` body to a temp `.js` file and run `node --check` on it.
- Game state is global, so you can drive tests from the browser console, for example `level=6`, `inv.misc=10`, `tryUpgrade()`,
  `health=5`, `survivorT=0.1` (spawns the next rescue), or move `boat.x/boat.y` (and `cam.x/cam.y`).
- Audio is synthesized in the browser (`SND` object) and starts on the first user gesture.

## Code map (inside `index.html`)

- **Units and projection:** game units on the sea plane (`x,y`) plus height `z`; one unit is `U` = 0.075 m in `world3d.js`, and game
  `(x,y,z)` maps to three.js `(x*U, z*U, y*U)`. A boat-local point `(lx,ly)` sits in a group rotated by `-boat.a`. `P(wx,wy,z)` and
  `unP(sx,sy)` project through the 3D camera (`R3D.project`/`unproject`) once `world3d.js` has loaded. The joystick and mini map use
  `JOYK`/`MAPY` from the camera angle. `frame()`/`rot()` give boat-local to world positions for the game logic.
- **Data tables:** `LEVELS` (boat layout per level: `rects`, `hull`, `cats`, `sternRaft`, `shack`/`tent`, crew positions `player`/`front`/
  `fisher`/`farmer`, `motor` x position), `COSTS` (upgrade cost per target level), `DESC` (upgrade messages), `ZOOMS`,
  `RESCUES` (levels whose next step is rescuing a stranded person instead of paying), `MAXLEVEL`, `MAP_LEVEL`.
- **`QUICK_TEST`** (top of the data section): `true` makes upgrades cheap and rescues spawn fast for testing.
  Set to `false` for real balance before launch.
- **Crew:** `crewList(L)` returns everyone on board with their role (`row`, `motor`, `none` = grappler, `fish`, `farm`);
  `world3d.js` gives crew index 0–3 a Kenney character (`CHAR`) with animations (sit, holding, throw, pick-up, die) and plays the
  fall-overboard death from `fallTime`/`fallDest` (`dieT`).
- **Systems in `update(dt)`:** health drain + heartbeat (`LOW`/`CRIT`), movement and rowing/motor, ruins collision, items
  (spawn/despawn ring around the boat), grapple (`G`), fishing (`FISH`), rescues (`survivorT`, `spawnSurvivor`), particles, gulls, fish schools.
- **Rendering:** `render()` calls `R3D.render()` (world3d.js: camera follow + zoom, water, boat rebuilt from `LEVELS[level]` by
  `buildBoat()`, items/ruins/gulls/fish/particles synced to the game arrays each frame), then draws the 2D overlay on top.
- **3D models:** `NEED` in world3d.js lists the GLBs to load; `fitModel(key,x,y,z)` clones one fitted to a size in metres;
  `weather()` mutes Kenney's palette; buildings get `grimy()` materials. Procedural props: tomato pot, outboard motor, gulls, junk.
- **Intro film:** `INTRO`, `playIntro(done)`, `introFrame(dt)` and one draw function per scene (`ISCENES`, captions in `ICAPS`),
  drawn on its own canvas (`#introcv`) from the main loop. Its sounds go through `SND.dest` = an intro bus; the ocean ambience sits
  on `SND.amb` so the intro can hold it back until the last scene. Plays automatically on page load with sound on by default (`tryIntroSound` starts audio at once;
  if the browser blocks autoplay, `introAudio(offset)` joins in at the current moment on the first tap or key press); the title screen appears afterwards.
- **States:** `menu`, `play`, `paused`, `over`; dying is `play` with `dieT >= 0`.
- **Save:** `localStorage` key `shanty_save` (level, inventory, health, position). Level numbers are stored directly, so inserting a level
  shifts old saves.

## Conventions

- Mobile first: touch joystick anywhere, HUD in HTML overlays (pointer-events only on buttons), safe-area insets respected.
- 3D art comes from the Kenney packs in `models/` plus simple procedural props; keep the muted, weathered post-apocalyptic look.
- Adding a level: add an entry to `LEVELS`, `DESC`, `ZOOMS`, either `COSTS` or `RESCUES`, bump `MAXLEVEL`, and update the README table.
