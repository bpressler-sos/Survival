# SURVIVAL — Moon Survival

A browser recreation of the 1980s BASIC text adventure *Survival* (Moon Survival),
written by Stewart Rush, 3/12/81. The world data (map, items, timings) follows the
original BASIC listings in `docs/`; the room descriptions use the longer prose of
the Big Computer Games listing.

---

## How to Run

Open `index.html` in any modern browser. No build step, no server, no dependencies.

```
index.html   ← open this in your browser
style.css    ← loaded automatically
gameData.js  ← loaded automatically (all static world data)
game.js      ← loaded automatically (engine and parser)
```

---

## The Game

You have crash landed on the moon. You have 400 minutes (80 turns, 5 minutes each)
to repair and refuel your spacecraft and blast off. Along the way you must survive
a meteor shower, a locked ventilator shed, an unlit shaft, a security robot, a
laser beam, and a nuclear bomb that detonates after 350 minutes.

There are 42 locations: the lunar surface (1–17), the wrecked spacecraft (18–21),
the ventilator shed and shaft (22–24) and the underground space station (25–42).

### Resources

| Resource | Notes |
|---|---|
| Time | 5 minutes per turn; 400 minutes total |
| Oxygen | Only drains while the oxygen module is carried. Required on the surface, and everywhere once the station air seal is blown |
| Power | The power unit (or the spare power pack) must be carried on the surface and inside the ship, otherwise you freeze |
| Inventory | 4 items maximum, and only one power supply at a time |

### Commands

| Command | Effect |
|---|---|
| `N` `S` `E` `W` `U` `D` (or `NORTH`, `SOUTH`, …) | Move |
| `LOOK` / `DESCRIBE` / `WAIT` | Re-describe the location — costs a turn, like the BASIC |
| `GET` / `TAKE` / `KEEP` `<item>` | Pick up an item |
| `DROP` / `LEAVE` / `PUT` `<item>` | Drop an item |
| `INVENTORY` | List carried items |
| `USE` / `TRY` `<item>` | Answer to an obstacle (meteor shower, locked shed, dark shaft, laser) |
| `DIG` | Dig in soft surface (Burg Crater) |
| `FUEL` | Load dilithium crystals in the ship's fuel store |
| `READ COMPUTER` | Read the station computer terminal |
| `TRANSPORT` | Beam between the transporter room and the transporter unit |
| `DEACTIVATE` | Disarm the nuclear bomb (deactivator required) |
| `BLAST` | Blast off from the ship's control room |
| `QUIT` / `END` | End the session |

Commands may be abbreviated to their first three letters.

### Tips

- Drop the oxygen module while you are inside the ship or the station: it only
  drains while it is carried.
- The overlook at Posidonius will make you lose the illuminator — leave it
  elsewhere before going there.
- The hangar is safe when it is entered through its air lock (changing area →
  air lock → hangar). Walking into it straight from the corridor blows the
  station air seal, and from then on oxygen is needed everywhere.
- The security robot only starts its patrol after it has seen you in the mess
  hall. Carry the coded badge or it will fire on you. Once the robot reaches the
  station control center, the corridor north of the elevator opens up.
- The bomb deactivator only appears (east of Mare Serenitatis) after 200 minutes.

---

## Architecture

| File | Purpose |
|---|---|
| `index.html` | UI structure only, no logic |
| `style.css` | Terminal styling |
| `gameData.js` | Static data: descriptions, movement matrix, item locations, name tables |
| `game.js` | Engine: state, turn loop, parser, command handlers, UI updates |

`gameData.js` mirrors the BASIC DATA statements:

- `T` — the 60 description lines (`T$` in the BASIC)
- `M_INIT` — the 42×8 movement matrix: `[N, S, E, W, U, D, firstTextLine, lastTextLine]`
  where `0` = no exit and `99` = a fatal drop
- `O_INIT` — the 14 object locations (`99` = carried, `0` = not yet on the map)
- `ITEM_NAME`, `ITEM_KEYS`, `LOC_NAME` — display and parser tables

---

## Corrections applied to the OCR'd BASIC

The data was cross-checked line by line against
`docs/Survival BASIC - Magazine BASIC.txt` (whose DATA statements are known good)
and `docs/Survival BASIC Code - Big Computer Games Version.txt`.

| # | Problem | Fix |
|---|---|---|
| 1 | Description line 33 ("At the center of Mare Imbrium.") was missing from the text table | Restored, which realigns every description from 33 onward. Locations 16–21 (the mare, the ship air lock, the cargo hold, the engine room and the control room) had been showing each other's text |
| 2 | Location 29 (corridor) led *south to the infirmary* | Corrected to the hangar (magazine listing line 5890). This restores the route to the bomb and the blown-seal event |
| 3 | Location short names for 11–13 and 16–21 named the wrong rooms | Renamed to match the descriptions |
| 4 | Oxygen was required in the ship's air lock | Oxygen is required below location 18 only (BASIC line 820), plus the hangar rule below |
| 5 | The hangar always required oxygen, and the seal could blow when arriving from the air lock | Reimplemented BASIC lines 830/1700/3590: the hangar holds air when entered from the air lock, and only an entry from corridor 29 blows the seal |
| 6 | Running out of power killed the player everywhere | Only fatal below location 22 or once the seal is blown (BASIC line 3680) |
| 7 | A power supply drained to exactly zero, which made the game unwinnable | Drain stops at a 5-unit reserve, as in the magazine listing (lines 690/700) |
| 8 | Exposing the deactivator did not shorten the "total darkness" descriptions | Reimplemented BASIC lines 3760/3770 |
| 9 | `LOOK` did not cost a turn, so a player standing at the dark area east of Mare Serenitatis could never wait for the deactivator and was stuck forever | `LOOK`/`DESCRIBE`/`WAIT` advance a turn as in the BASIC (line 650) |
| 10 | A failed attempt at the locked shed left the game stuck in "obstacle" mode | An obstacle now always resolves after one attempt; the shed simply stays locked |
| 11 | `TRANSPORT` only worked from the transporter room | Works in both directions (BASIC lines 1750–1820) |
| 12 | `DEACTIVATE` moved the bomb into the inventory and could exceed the carry limit | The bomb may be carried or simply present; it is left where it is |
