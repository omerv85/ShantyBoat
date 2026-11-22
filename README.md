# ShantyBoat

A mobile-first isometric survival game. The ice has melted, the seas have risen and the cities are drowned.
You live on a driftwood raft, scavenging the ocean to survive and grow your floating shanty home.

## Play

The whole game is a single file, `index.html` (HTML5 canvas + Web Audio, no dependencies or build step).

Serve the folder with any static server, for example:

```
python -m http.server 8765
```

Then open `http://localhost:8765`. To play on a phone, open `http://<your-computer-ip>:8765` on the same Wi-Fi.
Sound starts after the first tap (browsers require a user gesture).

## Graphics

The world is drawn in 3D with [three.js](https://threejs.org) (`world3d.js`): reflective water, real shadows, animated crew,
and drowned buildings. The HUD, mini map and floating text are drawn on a 2D layer on top.

Models in `models/` are from [Kenney](https://kenney.nl) (Pirate Kit, Survival Kit, City Kit Commercial, Mini Characters),
licensed CC0 (public domain). Each pack's `License.txt` is kept alongside its models.
The button icons in `icons/` are from Kenney's Game Icons (CC0). The resource counter icons are rendered at load time from the
game's own 3D models.

## How it plays

- **Intro:** the page opens with a short film: the polar ice melts, a glacier calves into the sea, a city drowns, and a lone raft
  drifts on the new ocean. Sound is on by default; browsers that block autoplay hold it until
  your first tap. Skip it any time, or replay it with
  "Watch the intro" on the title screen.
- **Row:** touch and drag anywhere for a floating joystick (arrow keys / WASD on desktop).
- **Grapple:** get close to wood, bottles or supply crates and a rope with a grapple hook is thrown automatically to reel them in. Junk is ignored.
- **Supply crates** contain one random item: a food tin, fresh water, or a spare part (screws, wire, metal parts).
- **Washing machines and fridges** float by now and then. They act like supply crates, but anything can be inside: food, water, a part, wood or plastic.
- **Health** drains slowly. Tap the food or water counter to eat or drink. Below 30% the health bar flashes and a heartbeat
  starts; at 10% the whole screen flashes and the heartbeat gets faster and louder. At zero the whole crew faints,
  then tumbles overboard into the water with a dying sound.
- **Zoom** with the magnifier buttons at the bottom left (or the mouse wheel / + and − keys). Your zoom is remembered.
- **Pause** with the pause button (or P / Esc). The game also pauses when you switch away from the tab.
- **Full screen:** on phones the game goes full screen on your first touch; the bottom-left button re-enters it.
  iPhone Safari doesn't support full screen for web pages, so on iPhone use Share → Add to Home Screen instead.
- **Upgrade** shows the cost and glows when you can afford it (chainsaw and hammer sounds included).
- **Wildlife:** gulls perch on floating junk and fly off when you get close; schools of fish swim through and scatter from the boat.

### Shanty levels

| Level | How you get it | What changes |
|---|---|---|
| 1 | Start | Simple square raft, survivor sitting in rags in the middle |
| 2 | 8 wood, 5 plastic | Larger raft on bottle floats, driftwood A-frame tent |
| 3 | 16 wood, 10 plastic | Outrigger rafts on both sides, connected by planks |
| 4 | 24 wood, 14 plastic | The tent becomes a plank shack with a stovepipe |
| 5 | 5 parts | A mini map (with a spinning scrap antenna on the shack roof) |
| 6 | Rescue the survivor shown on the mini map | Extra raft square on the front; the rescued survivor sits there and works the grapple |
| 7 | 10 parts | Outboard motor on the back replaces the paddle |
| 8 | 32 wood, 18 plastic | Center and front rafts become one rowboat hull with wooden sides |
| 9 | 40 wood, 24 plastic | Catamaran pontoons replace the side rafts |
| 10 | Rescue the fisher shown on the mini map | The fisher joins the crew and casts at passing schools of fish, catching food |
| 11 | Rescue the farmer shown on the mini map | A stern raft is added behind the boat with the farmer and their potted tomato plant; the motor moves to its back |

Stranded people appear far away, out of view, a few seconds after you reach level 5, 9 or 10. They stay where they are until
you reach them, and a yellow **!** on the mini map shows the way (pinned to the map's edge when they're far off).

## Tuning

`QUICK_TEST` near the top of the script is currently `true`: upgrades cost only a few items (2 wood + 1 plastic up to
6 wood + 3 plastic, 1 part for the mini map, 2 parts for the motor) and rescues appear after 3 seconds, so the whole progression can be tested quickly.
The costs in the table above are the normal ones you get with `QUICK_TEST=false`.

Other numbers are constants near the top of the script: `COSTS`, `DRAIN`, `EAT`, `DRINK`, `LOW`, `CRIT`.

## Roadmap

Enemies (hostile ships, sharks, giant squids), more survivors to collect, ship combat, fishing, jumping into the water,
trade posts, mini map, pause menu, game over menu, hints.
