# CLAUDE.md

Guidance for Claude Code when working on **Shanty Boat**, a mobile-first isometric survival game.

## Workflow rules

- **Always commit and push to `main` after every change.** The repo is the rollback mechanism and there are no real users yet.
- Pushing to `main` deploys: a Cloudflare Worker linked to this GitHub repo serves the game at
  https://shantyboat.o-vertman.workers.dev/. After pushing, check the live site loads the new version.
- Keep the README's level table and feature list in sync with the game.

## Project layout

- `index.html` — the entire game: HTML HUD, CSS, and one `<script>` (canvas 2D rendering + Web Audio). No build step, no dependencies
  (only the Google Font "Pirata One" for titles).
- `prototype3d.html` — standalone three.js look-and-feel prototype (three@0.160.0 from jsdelivr via an import map; Water and Sky
  from three's examples). Models load from `models/` (list in `NEED`); `model(key,size)` clones and scales one, `character()` adds
  an animated person, `weather()` mutes Kenney's bright palette. `window.proto` exposes `boat`/`ruins` for console testing.
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

- **Projection:** world `x,y` (ground plane) + `z` (height) → 2:1 isometric screen via `P(wx,wy,z)`; `unP` inverts.
  `frame(x,y,angle,z)` + `proj(frame, [lx,ly,lz])` place local-space geometry. `face()`, `box()`, `prism()` and `solidPoly()` draw
  shaded faces with back-face culling; painter's order is by `x+y` depth.
- **Data tables:** `LEVELS` (boat layout per level: `rects`, `hull`, `cats`, `sternRaft`, `shack`/`tent`, crew positions `player`/`front`/
  `fisher`/`farmer`, `motor` x position), `COSTS` (upgrade cost per target level), `DESC` (upgrade messages), `ZOOMS`,
  `RESCUES` (levels whose next step is rescuing a stranded person instead of paying), `MAXLEVEL`, `MAP_LEVEL`.
- **`QUICK_TEST`** (top of the data section): `true` makes upgrades cheap and rescues spawn fast for testing.
  Set to `false` for real balance before launch.
- **Crew:** `crewList(L)` returns everyone on board with their role (`row`, `motor`, `none` = grappler, `fish`, `farm`);
  `drawPerson()` draws people (styles `STYLE1`–`STYLE4`), including the faint and fall-overboard death animation (`dieT`).
- **Systems in `update(dt)`:** health drain + heartbeat (`LOW`/`CRIT`), movement and rowing/motor, ruins collision, items
  (spawn/despawn ring around the boat), grapple (`G`), fishing (`FISH`), rescues (`survivorT`, `spawnSurvivor`), particles, gulls, fish schools.
- **Rendering in `render()`:** sea and waves → ripples → fish → sorted scene (ruins, items, boat) → rope/fishing line → particles → gulls →
  text → haze/vignette → mini map → low-health overlays → joystick.
- **Intro film:** `INTRO`, `playIntro(done)`, `introFrame(dt)` and one draw function per scene (`ISCENES`, captions in `ICAPS`),
  drawn on its own canvas (`#introcv`) from the main loop. Its sounds go through `SND.dest` = an intro bus; the ocean ambience sits
  on `SND.amb` so the intro can hold it back until the last scene. Plays automatically on page load with sound on by default (`tryIntroSound` starts audio at once;
  if the browser blocks autoplay, `introAudio(offset)` joins in at the current moment on the first tap or key press); the title screen appears afterwards.
- **States:** `menu`, `play`, `paused`, `over`; dying is `play` with `dieT >= 0`.
- **Save:** `localStorage` key `shanty_save` (level, inventory, health, position). Level numbers are stored directly, so inserting a level
  shifts old saves.

## Conventions

- Mobile first: touch joystick anywhere, HUD in HTML overlays (pointer-events only on buttons), safe-area insets respected.
- Draw everything procedurally (no image assets); keep new art in the same flat, muted post-apocalyptic palette.
- Adding a level: add an entry to `LEVELS`, `DESC`, `ZOOMS`, either `COSTS` or `RESCUES`, bump `MAXLEVEL`, and update the README table.
