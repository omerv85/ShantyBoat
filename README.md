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

## How it plays

- **Row:** touch and drag anywhere for a floating joystick (arrow keys / WASD on desktop).
- **Grapple:** get close to wood, bottles or supply crates and a rope with a grapple hook is thrown automatically to reel them in. Junk is ignored.
- **Supply crates** contain one random item: a food tin, fresh water, or a spare part (screws, wire, metal parts).
- **Health** drains slowly. Tap the food or water counter to eat or drink.
- **Upgrade Home** appears with costs and glows when you have enough wood and bottles (chainsaw and hammer sounds included).

### Home stages

1. Simple square raft, the survivor sitting in rags in the middle
2. Larger raft on bottle floats, with a driftwood A-frame tent
3. Outrigger rafts on both sides, connected by planks
4. The tent becomes a plank shack with a door, windows and a stovepipe
5. More to come

## Tuning

Costs and survival numbers are constants near the top of the script: `COSTS`, `DRAIN`, `EAT`, `DRINK`.

## Roadmap

Enemies (hostile ships, sharks, giant squids), fellow survivors, ship combat, fishing, jumping into the water,
trade posts, better navigation than the wooden oar, mini map, pause menu, game over menu, hints.
