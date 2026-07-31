/**
 * gameData.js — SURVIVAL (Moon Survival, original by Stewart Rush, 3/12/81)
 *
 * Faithful JavaScript port of the BASIC text adventure.
 * All static world data lives here; game logic is in game.js.
 *
 * ── OCR / Bug fixes applied ──────────────────────────────────────────────────
 *  Data verified against docs/Survival BASIC - Magazine BASIC.txt (the version
 *  whose DATA statements are known good) and the Big Computer Games listing.
 *
 *  1. f9 initial = 0 (BASIC OCR had 8; caused instant station death)
 *  2. o(9) fuel-loaded sentinel = 98 (OCR had 984)
 *  3. Drop-item bug: checked o(1) instead of o(i)
 *  4. Text line 33 ("At the center of Mare Imbrium.") had been dropped from the
 *     description table, which shifted every description from 33 on by one and
 *     made locations 16-21 (mare, ship air lock, cargo, engine, control room)
 *     print the wrong room text
 *  5. Movement matrix loc 29 S = 38 (the hanger). The Big Computer Games OCR
 *     had 30 (the infirmary), which broke the hanger/air-lock routes and the
 *     blown-seal event. Magazine listing line 5890 confirms 38.
 *  6. Location short names for 11-13 and 16-21 corrected to match the rooms
 *  7. needsOxygen() = p < 18 (BASIC line 820); the hanger is handled by the
 *     air-lock rule in game.js (BASIC lines 830/1700)
 *  8. Expose-deactivator routine places o[6] at loc 14 (missing from OCR)
 *  9. Bomb detonation at t1 > 350 (BASIC section was empty/corrupted)
 * 10. Various OCR typos in text strings corrected
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TEXT DESCRIPTIONS  (t$[1..60]; index 0 and 61 are unused placeholders)
// ─────────────────────────────────────────────────────────────────────────────

const T = [
  '',  // [0] unused
  /* 1 */ 'At Mare Serenitatis. Long eerie shadows',
  /* 2 */ 'from distant mountains and craters cast',
  /* 3 */ 'themselves across the barren landscape.',
  /* 4 */ 'On a promontory point on the rim of the',
  /* 5 */ 'crater Posidonius, only half visible.',
  /* 6 */ 'There is total darkness to the east,',
  /* 7 */ 'between the craters of Dawes and Plinius.',
  /* 8 */ 'At a pass in the mountains of Haemus.',
  /* 9 */ 'At the base of the crater Manilus.',
  /* 10 */ 'At Mare Vaporum. The Apennine mountains',
  /* 11 */ 'rise ominously to the north and west.',
  /* 12 */ 'At the base of the awesome Mt. Eudoxus.',
  /* 13 */ 'Inside the crater of Aristoteles. The',
  /* 14 */ 'crater floor is littered with rocks.',
  /* 15 */ 'In Lacus Somniorum, north of Posidonius',
  /* 16 */ 'and northeast of Mare Serenitatis.',
  /* 17 */ 'At the base of the Burg Crater in Lacus',
  /* 18 */ 'Mortis. The surface is very soft here.',
  /* 19 */ 'At the east side of the vast Mare of',
  /* 20 */ 'Imbrium. To the north the low angle of',
  /* 21 */ 'the sun casts eerie shadows on the soft',
  /* 22 */ 'surface and distant mountains to the',
  /* 23 */ 'east. To the west, the mare stretches',
  /* 24 */ 'out of sight to the horizon.',
  /* 25 */ 'At the base of the crater of Plato. A',
  /* 26 */ 'shiny object is seen to the west.',
  /* 27 */ 'Standing before a small metal shed. A',
  /* 28 */ "sign reads: 'Ventilator Shaft 02.'",
  /* 29 */ 'Somewhere east of Mare Serenitatis.',
  /* 30 */ 'There is total darkness.',
  /* 31 */ 'At the crash site of a spacecraft.',
  /* 32 */ 'The ship entrance is before you.',
  /* 33 */ 'At the center of Mare Imbrium.',
  /* 34 */ 'In the air lock chamber of the ship.',
  /* 35 */ 'In the aft cargo and fuel storage room.',
  /* 36 */ 'In the engine room of the spacecraft.',
  /* 37 */ "In the control room. The ship's console",
  /* 38 */ 'is before you.',
  /* 39 */ 'Inside a dark shed. A ladder leads down',
  /* 40 */ 'into a large metal shaft.',
  /* 41 */ 'In a ventilator passage.',
  /* 42 */ 'At a ventilator opening. Through the',
  /* 43 */ 'opening a lit passageway can be seen.',
  /* 44 */ 'In a lighted space station corridor.',
  /* 45 */ 'In the space station infirmary.',
  /* 46 */ 'In the recreation room and library.',
  /* 47 */ 'In the mess hall. Abandoned food trays',
  /* 48 */ 'are still on the tables.',
  /* 49 */ 'In the storage room and supply area.',
  /* 50 */ 'In the sleeping quarters.',
  /* 51 */ 'In an elevator at subsurface level.',
  /* 52 */ 'In an elevator at surface level.',
  /* 53 */ 'In the station control center.',
  /* 54 */ 'In the transporter room.',
  /* 55 */ 'In the space station laboratory.',
  /* 56 */ 'In the hanger area. The launch area',
  /* 57 */ 'is just to the south.',
  /* 58 */ 'In an air lock chamber between the',
  /* 59 */ 'changing area and the hanger.',
  /* 60 */ 'In a space suit changing area.',
  '',  // [61] unused placeholder
];

// ─────────────────────────────────────────────────────────────────────────────
// MOVEMENT MATRIX  m[p] = [N, S, E, W, U, D, T1, T2]
//
//   Columns 0-5 : destination location for that direction (0=blocked, 99=death)
//   Columns 6-7 : first/last T[] index for this location's text description
//
// Corrections vs. BASIC OCR:
//   • Loc 29 S = 38 (hanger) per the magazine listing; the Big Computer Games
//     OCR read 30 (infirmary), which sent the player to the wrong room and
//     made the hanger unreachable from the corridor.
// ─────────────────────────────────────────────────────────────────────────────

//                    N    S    E    W    U    D   T1  T2
const M_INIT = [
  null,              //  0  (unused)
  [ 7,  4,  2, 15,  0,  0,  1,  3],  //  1 Mare Serenitatis
  [ 9,  3, 14,  1,  0,  0,  4,  6],  //  2 Overlook at Posidonius
  [ 2,  5, 14,  4,  0,  0,  7,  7],  //  3 Darkness east
  [ 1,  5,  3,  0,  0,  0,  8,  8],  //  4 Pass in Haemus
  [ 4,  0,  3,  6,  0,  0,  9,  9],  //  5 Base of Manilus
  [ 0,  0,  5,  0,  0,  0, 10, 11],  //  6 Mare Vaporum (dead end, illuminator here)
  [ 8,  1,  9, 11,  0,  0, 12, 12],  //  7 Base of Eudoxus
  [ 0,  7, 10,  0,  0,  0, 13, 14],  //  8 Aristoteles crater
  [10,  2, 14,  7,  0,  0, 15, 16],  //  9 Lacus Somniorum
  [ 0,  9, 14,  8,  0,  0, 17, 18],  // 10 Burg Crater (soft surface — dig here)
  [12, 15,  7, 16,  0,  0, 19, 24],  // 11 East side of Mare Imbrium
  [ 0, 11,  0, 13,  0,  0, 25, 26],  // 12 Plato crater base (meteor shower W)
  [ 0, 16, 12, 22,  0,  0, 27, 28],  // 13 Before the metal shed (locked W)
  [99, 99, 99, 99,  0,  0, 29, 30],  // 14 Dark area east (all exits=death initially)
  [11, 18,  1,  0,  0,  0, 31, 32],  // 15 Spacecraft crash site
  [17, 16,  7, 16,  0,  0, 33, 33],  // 16 Center of Mare Imbrium (wandering)
  [16, 17, 11, 17,  0,  0, 33, 33],  // 17 Center of Mare Imbrium (wandering)
  [15, 19,  0,  0,  0,  0, 34, 34],  // 18 Ship air lock chamber
  [18,  0, 20,  0,  0,  0, 35, 35],  // 19 Aft cargo / fuel storage (FUEL here)
  [ 0,  0,  0, 19, 21,  0, 36, 36],  // 20 Engine room
  [ 0,  0,  0,  0,  0, 20, 37, 38],  // 21 Ship control room (BLAST here)
  [ 0,  0, 13,  0,  0, 23, 39, 40],  // 22 Shed interior
  [24,  0,  0,  0, 22,  0, 41, 41],  // 23 Ventilator shaft
  [25, 23,  0,  0,  0,  0, 42, 43],  // 24 Ventilator opening
  [27, 26, 33, 32, 24,  0, 44, 44],  // 25 Station corridor
  [25,  0, 30, 31,  0,  0, 44, 44],  // 26 Station corridor
  [34, 25, 41,  0,  0,  0, 44, 44],  // 27 Station corridor
  [ 0, 29, 42, 36,  0,  0, 44, 44],  // 28 Station corridor
  [28, 38, 40, 37,  0,  0, 44, 44],  // 29 Station corridor (S = hanger)
  [ 0,  0,  0, 26,  0,  0, 45, 45],  // 30 Infirmary
  [ 0,  0, 26,  0,  0,  0, 46, 46],  // 31 Recreation room
  [ 0,  0, 25,  0,  0,  0, 47, 48],  // 32 Mess hall
  [ 0,  0,  0, 25,  0,  0, 50, 50],  // 33 Sleeping quarters
  [ 0, 27,  0,  0,  0,  0, 49, 49],  // 34 Storage room
  [ 0, 28,  0,  0, 24,  0, 53, 53],  // 35 Station control center
  [ 0,  0, 28,  0,  0,  0, 54, 54],  // 36 Transporter room
  [ 0,  0, 29,  0,  0,  0, 55, 55],  // 37 Laboratory
  [29,  0, 39,  0,  0,  0, 56, 57],  // 38 Hanger area
  [40,  0,  0, 38,  0,  0, 58, 59],  // 39 Airlock (changing↔hanger)
  [ 0, 39,  0, 29,  0,  0, 60, 60],  // 40 Space suit changing area
  [ 0,  0,  0, 27, 42,  0, 51, 51],  // 41 Elevator – subsurface
  [ 0,  0,  0, 28,  0, 41, 52, 52],  // 42 Elevator – surface
];

// ─────────────────────────────────────────────────────────────────────────────
// OBJECT INITIAL LOCATIONS  o[1..14]
//   99 = in player inventory, 0 = not yet on map, other = location number
// ─────────────────────────────────────────────────────────────────────────────

// Index:          0     1   2   3    4   5   6   7   8    9  10  11  12  13  14
const O_INIT = [null,  21, 19,  99,  6, 32,  0, 38, 35,  0, 35, 99, 33, 34, 37];
//  1 electronic key  → loc 21 (spacecraft control room)
//  2 sealant         → loc 19 (aft cargo/fuel storage)
//  3 oxygen module   → 99 (player carries from start)
//  4 illuminator     → loc  6 (Mare Vaporum dead end)
//  5 robot           → loc 32 (mess hall)
//  6 deactivator     → 0  (buried; appears at loc 14 after t1>200)
//  7 nuclear bomb    → loc 38 (hanger, needs O₂ to reach)
//  8 transporter unit→ loc 35 (station control center)
//  9 dilithium cryst.→ 0  (buried at loc 10; DIG command reveals it)
// 10 computer message→ loc 35 (station control center)
// 11 power unit      → 99 (player carries from start)
// 12 mirror          → loc 33 (sleeping quarters)
// 13 coded badge     → loc 34 (storage room)
// 14 power pack      → loc 37 (laboratory)

// ─────────────────────────────────────────────────────────────────────────────
// ITEM NAMES  (definite article form used in "There is … here")
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_NAME = [
  null,                   //  0 unused
  'an electronic key',    //  1
  'sealant',              //  2
  'an oxygen module',     //  3
  'an illuminator',       //  4
  'a robot',              //  5
  'a deactivator',        //  6
  'a nuclear bomb',       //  7
  'a transporter unit',   //  8
  'dilithium crystals',   //  9
  'a computer message',   // 10
  'a power unit',         // 11
  'a mirror',             // 12
  'a coded badge',        // 13
  'a power pack',         // 14
];

// ─────────────────────────────────────────────────────────────────────────────
// ITEM KEYWORD MAP  first-3-letters of noun → item index
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_KEYS = {
  ele: 1, key: 1,
  sea: 2,
  oxy: 3, mod: 3,
  ill: 4,
  rob: 5,
  dea: 6,
  nuc: 7, bom: 7,
  tra: 8,
  dil: 9, cry: 9,
  com: 10, mes: 10,
  uni: 11,
  mir: 12,
  bad: 13,
  pac: 14,
};

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION SHORT NAMES  (for HUD display)
// ─────────────────────────────────────────────────────────────────────────────

const LOC_NAME = [
  '',
  'Mare Serenitatis',         //  1
  'Posidonius Overlook',      //  2
  'Darkness (Dawes/Plinius)', //  3
  'Haemus Pass',              //  4
  'Manilus Base',             //  5
  'Mare Vaporum',             //  6
  'Mt. Eudoxus Base',         //  7
  'Aristoteles Crater',       //  8
  'Lacus Somniorum',          //  9
  'Burg Crater (soft)',       // 10
  'East Mare Imbrium',        // 11
  'Plato Crater Base',        // 12
  'Before Metal Shed',        // 13
  'Eastern Darkness',         // 14
  'Spacecraft Crash Site',    // 15
  'Center of Mare Imbrium',   // 16
  'Center of Mare Imbrium',   // 17
  'Ship Air Lock',            // 18
  'Aft Cargo / Fuel',         // 19
  'Engine Room',              // 20
  'Ship Control Room',        // 21
  'Shed Interior',            // 22
  'Ventilator Shaft',         // 23
  'Ventilator Opening',       // 24
  'Station Corridor',         // 25
  'Station Corridor',         // 26
  'Station Corridor',         // 27
  'Station Corridor',         // 28
  'Station Corridor',         // 29
  'Infirmary',                // 30
  'Recreation Room',          // 31
  'Mess Hall',                // 32
  'Sleeping Quarters',        // 33
  'Storage Room',             // 34
  'Control Center',           // 35
  'Transporter Room',         // 36
  'Laboratory',               // 37
  'Hanger Area',              // 38
  'Hanger Airlock',           // 39
  'Suit Changing Area',       // 40
  'Elevator (subsurface)',    // 41
  'Elevator (surface)',       // 42
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Locations where breathable air is NOT available (BASIC line 820: p < 18).
 * The moon surface (1-17) always needs oxygen. The wrecked ship (18-21) and
 * the space station (22-42) hold pressure, except the hanger (38), which is
 * handled separately because it is safe only when entered through its air
 * lock (BASIC lines 830/1700).
 */
function needsOxygen(p) {
  return p < 18;
}

/**
 * Locations where a power supply must be kept to survive (BASIC line 2710:
 * p < 22, p = 38, or the station seal has been blown).
 */
function needsPower(p) {
  return p < 22 || p === 38;
}

/**
 * Locations where running out of power is fatal (BASIC line 3680: p < 22 or
 * the station air seal has been blown).
 */
function powerFatal(p, f9) {
  return p < 22 || f9 === 1;
}
