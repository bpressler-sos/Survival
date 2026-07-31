# SURVIVAL — Space Station Omega

A faithful browser-based recreation of the classic 1980s BASIC text adventure *Survival*, modernised as a clean HTML5/JavaScript game while preserving the original gameplay feel and mechanics.

---

## How to Run

Open `index.html` in any modern web browser. No build step, no server, no dependencies required — everything runs client-side.

```
index.html   ← open this in your browser
style.css    ← loaded automatically
gameData.js  ← loaded automatically
game.js      ← loaded automatically
```

---

## What is this?

The original *Survival* was a BASIC text adventure published in a 1980s computing magazine. It featured:

- A sci-fi space-station setting
- Resource management (oxygen, power)
- A patrolling security robot
- Dark rooms requiring a flashlight
- A transporter system
- A bomb/deactivator puzzle
- Classic verb-noun text parser

This repository contains a ground-up HTML5/JavaScript recreation that:
- Preserves the original story, map, items, puzzles, and commands
- Separates game data from game logic for maintainability
- Adds a polished DOS-inspired UI with direction buttons, inventory panel, and HUD
- Implements approved gameplay improvements (see below)

---

## How to Play

Type commands into the input box, or use the direction buttons and quick-action buttons in the sidebar.

### Commands

| Command | Effect |
|---|---|
| `N` / `NORTH` | Move north |
| `S` / `SOUTH` | Move south |
| `E` / `EAST`  | Move east |
| `W` / `WEST`  | Move west |
| `LOOK` / `L`  | Describe current room |
| `EXAMINE <item>` / `X <item>` | Examine an item |
| `GET <item>` / `TAKE <item>` | Pick up an item |
| `DROP <item>` | Drop an item |
| `USE <item>` | Use an item |
| `INVENTORY` / `I` | List carried items |
| `HELP` / `?` | Show help |
| `RESTART` | Start a new game |

### Tips

- Watch your **O₂** (oxygen) level — it drops every turn. Find tanks to extend it.
- **Dark areas** require the flashlight to explore safely.
- The **security robot** is dangerous. Carry your security badge to pass safely.
- The **bomb** must be deactivated before the escape pod will launch.
- The **transporter** requires station power to be restored and an authorization keycard.

---

## Map Overview

```
[25:OXYGEN BAY]─── [05:W CORR] ─── [01:COMMAND CTR] ─── [03:E CORR] ─── [08:MED BAY]
                        │                 │    │                │               │
                   [13:STOR A]       [02:N CORR] [04:S CORR] [09:LAB]      [14:STOR B]
                   │   │                 │         │    │       │
              [12:COMP][14]          [06:AIRLOCK] [10:ENG][11:POWER][22:DEACT]
                             │        │    │         │
                          [07:OUTER] [21:TRANS]   [17:ROBOT ZONE]─[16:DARK]─[15:DARK]
                                                     │
                                                  [18:BASE EXT]
                                                     │
                                                  [19:BASE ENTRY]
                                                     │
                                                  [20:CTRL ROOM]──[23:ESC CORR]──[24:PODS]
```

---

## Architecture

| File | Purpose |
|---|---|
| `index.html` | Shell — UI structure only, no logic |
| `style.css` | DOS-inspired terminal styling |
| `gameData.js` | All static data: rooms, items, messages, config |
| `game.js` | Engine: state, parser, command handlers, UI updates |

### `gameData.js`
- `GAME_CONFIG` — tunable constants (oxygen, power, inventory limit, robot warnings)
- `ROOMS` — 25 rooms with descriptions, exits, item lists, flags (`dark`, `robotPatrol`, `special`)
- `ITEMS` — 12 portable items with keywords, descriptions, and `useEffect` tags
- `MESSAGES` — all player-facing text strings (win, death, warnings, etc.)
- `DIR_ALIASES` / `DIR_DISPLAY` / `DIR_OPPOSITE` — direction normalisation tables

### `game.js`
- `GameState` — single mutable object; reset on restart
- `parseInput()` — tokeniser; maps verb → command function
- `cmdGo()` — movement with dark-room safety logic
- `cmdGet()` / `cmdDrop()` — item transfer (room ↔ inventory)
- `cmdUse()` — dispatches on `item.useEffect` tag
- `cmdActivateEscapePod()` / `cmdActivateTransporter()` / `cmdDeactivateBomb()` — special interactions
- `processRobot()` — two-turn warning system before robot kills
- `tickResources()` — decrement oxygen/power, check death conditions
- `onTurnEnd()` — called after every turn-consuming action
- `update*()` — DOM helpers for HUD, direction buttons, inventory, room items
- `initQuickActions()` / `showItemPicker()` — quick-action button logic

---

## Known OCR Issues and Reconstructed Assumptions

The following assumptions were made where the original BASIC source or magazine text was ambiguous or corrupted:

| # | Issue | Assumption Made |
|---|---|---|
| 1 | Exact starting oxygen value | Set to 80–100 range; raised to 120 per approved adjustment |
| 2 | Exact starting power value | Set to 60–80 range; raised to 100 per approved adjustment |
| 3 | Original inventory limit | Assumed 5 slots; raised to 6 per approved adjustment |
| 4 | Transporter destination | Original BASIC destination unclear; set to Room 19 (Robot Base Entry) as most logical shortcut |
| 5 | Bomb timer vs. escape condition | Original unclear; implemented as a win-condition requirement (must defuse) rather than a countdown |
| 6 | Robot patrol rooms | Rooms 17 and 18 flagged as patrol rooms based on narrative context |
| 7 | Dark room contents | Keycard placed in Room 16 (Dark Chamber) as a reward for exploring dark areas |
| 8 | Power cell location | Storage Room A; consistent with engineering-supply context |

---

## Intentional Gameplay Improvements

These improvements were explicitly approved before implementation:

1. **Dark-room safety fix** — The player always knows which direction they entered a dark room from, and can safely retrace that step. Only other directions are blocked in darkness (no unfair trapping).

2. **Robot encounter fairness** — The robot gives two turns of escalating warning before killing the player. The player has time to retreat or equip their badge.

3. **Consistent room exits** — All exits are reciprocal. Robot base interior rooms (17–20) have corrected east/west/north/south links that match the intended map layout.

4. **Raised starting resources** — Oxygen increased from ~80–100 to 120; power increased from ~60–80 to 100. The game remains challenging but reduces early frustration.

5. **Increased inventory capacity** — Limit raised from 5 to 6 slots, giving slightly more flexibility without removing the strategic weight of item management.

---

## Original vs. Modern

| Aspect | Original BASIC | This Recreation |
|---|---|---|
| Platform | 8-bit home computer (BASIC) | Any modern browser |
| Parser | Line-number GOTO chains | Structured verb-noun parser |
| Data | Embedded in code (DATA lines) | Separate `gameData.js` |
| UI | Terminal text only | Transcript + direction pad + HUD |
| Bugs | Dark room trapping, instant robot death | Fixed per approved list |
| Maintainability | BASIC spaghetti | Documented, modular JS |