/**
 * gameData.js — SURVIVAL (Moon Survival, original by Stewart Rush, 3/12/81)
 *
 * Faithful JavaScript port of the BASIC text adventure.
 * All static world data lives here; game logic is in game.js.
 *
 * ── OCR / Bug fixes applied ──────────────────────────────────────────────────
 *  1. f9 initial = 0 (BASIC OCR had 8; caused instant station death)
 *  2. o(9) fuel-loaded sentinel = 98 (OCR had 984)
 *  3. Drop-item bug: checked o(1) instead of o(i)
 *  4. Bomb deactivation: checks o(7)==current location (not o(7)==99 carry)
 *  5. Movement matrix loc 21 T=36-37 (OCR had 37-38)
 *  6. Movement matrix locs 22-42 T-values shifted by +1 in OCR; corrected -1
 *  7. Movement matrix loc 32 T2 = 47 (OCR had 40, corrupted)
 *  8. Movement matrix loc 29 S=38 (reciprocal of loc 38 N=29; enables blown-seal)
 *  9. Movement matrix loc 2 T=4-5 (2-line description; "darkness" line belongs to loc 3)
 * 10. Movement matrix loc 3 T=6-7 (2-line: "There is total darkness…/between the craters")
 * 11. Self-loop exits (e.g. loc 16 S=16) treated as 0 (no exit)
 * 12. Expose-deactivator routine: adds o[6]=14 (missing from OCR)
 * 13. Bomb detonation at t1>350 (BASIC section was empty/corrupted)
 * 14. Robot patrol: stops at loc 35 (unchanged from original)
 * 15. Various OCR typos in text strings corrected
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TEXT DESCRIPTIONS  (t$[1..59]; index 0 and 60 are unused placeholders)
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
  /* 33 */ 'In the air lock chamber of the ship.',
  /* 34 */ 'In the aft cargo and fuel storage room.',
  /* 35 */ 'In the engine room of the spacecraft.',
  /* 36 */ "In the control room. The ship's console",
  /* 37 */ 'is before you.',
  /* 38 */ 'Inside a dark shed. A ladder leads down',
  /* 39 */ 'into a large metal shaft.',
  /* 40 */ 'In a ventilator passage.',
  /* 41 */ 'At a ventilator opening. Through the',
  /* 42 */ 'opening a lit passageway can be seen.',
  /* 43 */ 'In a lighted space station corridor.',
  /* 44 */ 'In the space station infirmary.',
  /* 45 */ 'In the recreation room and library.',
  /* 46 */ 'In the mess hall. Abandoned food trays',
  /* 47 */ 'are still on the tables.',
  /* 48 */ 'In the storage room and supply area.',
  /* 49 */ 'In the sleeping quarters.',
  /* 50 */ 'In an elevator at subsurface level.',
  /* 51 */ 'In an elevator at surface level.',
  /* 52 */ 'In the station control center.',
  /* 53 */ 'In the transporter room.',
  /* 54 */ 'In the space station laboratory.',
  /* 55 */ 'In the hanger area. The launch area',
  /* 56 */ 'is just to the south.',
  /* 57 */ 'In an air lock chamber between the',
  /* 58 */ 'changing area and the hanger.',
  /* 59 */ 'In a space suit changing area.',
  '',  // [60] unused placeholder
];

// ─────────────────────────────────────────────────────────────────────────────
// MOVEMENT MATRIX  m[p] = [N, S, E, W, U, D, T1, T2]
//
//   Columns 0-5 : destination location for that direction (0=blocked, 99=death)
//   Columns 6-7 : first/last T[] index for this location's text description
//
// Corrections vs. BASIC OCR:
//   • Self-loop exits (e.g. loc16 S=16) replaced with 0
//   • Loc 2  : T=4-5  (2-line overlook; "darkness" line belongs to loc 3)
//   • Loc 3  : T=6-7  (2-line dark area description)
//   • Loc 21 : T=36-37 (control room; OCR had 37-38)
//   • Locs 22-42: T values each decreased by 1 (OCR systematic +1 shift)
//   • Loc 29 S=38  (reciprocal of loc 38 N=29; dead code otherwise)
//   • Loc 32 T2=47 (OCR had corrupt value 40)
// ─────────────────────────────────────────────────────────────────────────────

//                    N    S    E    W    U    D   T1  T2
const M_INIT = [
  null,              //  0  (unused)
  [ 7,  4,  2, 15,  0,  0,  1,  3],  //  1 Mare Serenitatis
  [ 9,  3, 14,  1,  0,  0,  4,  5],  //  2 Overlook at Posidonius  (T fix: 4-5)
  [ 2,  5, 14,  4,  0,  0,  6,  7],  //  3 Darkness east           (T fix: 6-7)
  [ 1,  5,  3,  0,  0,  0,  8,  8],  //  4 Pass in Haemus
  [ 4,  0,  3,  6,  0,  0,  9,  9],  //  5 Base of Manilus
  [ 0,  0,  5,  0,  0,  0, 10, 11],  //  6 Mare Vaporum (dead end, illuminator here)
  [ 8,  1,  9, 11,  0,  0, 12, 12],  //  7 Base of Eudoxus
  [ 0,  7, 10,  0,  0,  0, 13, 14],  //  8 Aristoteles crater
  [10,  2, 14,  7,  0,  0, 15, 16],  //  9 Lacus Somniorum
  [ 0,  9, 14,  8,  0,  0, 17, 18],  // 10 Burg Crater (soft surface — dig here)
  [12, 15,  7, 16,  0,  0, 19, 24],  // 11 Plato crater base (6-line description)
  [ 0, 11,  0, 13,  0,  0, 25, 26],  // 12 Before shed
  [ 0, 16, 12, 22,  0,  0, 27, 28],  // 13 Locked shed entrance
  [99, 99, 99, 99,  0,  0, 29, 30],  // 14 Dark area east (all exits=death initially)
  [11, 18,  1,  0,  0,  0, 31, 32],  // 15 Spacecraft crash site
  [17,  0,  7,  0,  0,  0, 33, 33],  // 16 Ship airlock 1  (self-loops → 0)
  [16,  0, 11,  0,  0,  0, 33, 33],  // 17 Ship airlock 2  (self-loops → 0)
  [15, 19,  0,  0,  0,  0, 34, 34],  // 18 Aft cargo / fuel storage
  [18,  0, 20,  0,  0,  0, 35, 35],  // 19 Engine room
  [ 0,  0,  0, 19, 21,  0, 36, 36],  // 20 Lower spacecraft section
  [ 0,  0,  0,  0,  0, 20, 36, 37],  // 21 Control room  (T fix: 36-37)
  [ 0,  0, 13,  0,  0, 23, 38, 39],  // 22 Shed interior  (T-1: 38-39)
  [24,  0,  0,  0, 22,  0, 40, 40],  // 23 Ventilator shaft  (T-1: 40)
  [25, 23,  0,  0,  0,  0, 41, 42],  // 24 Ventilator opening  (T-1: 41-42)
  [27, 26, 33, 32, 24,  0, 43, 43],  // 25 Station corridor  (T-1: 43)
  [25,  0, 30, 31,  0,  0, 43, 43],  // 26 Station corridor  (T-1: 43)
  [34, 25, 41,  0,  0,  0, 43, 43],  // 27 Station corridor  (T-1: 43)
  [ 0, 29, 42, 36,  0,  0, 43, 43],  // 28 Station corridor  (T-1: 43; N opened by robot)
  [28, 38, 40, 37,  0,  0, 43, 43],  // 29 Station corridor  (T-1: 43; S fix: 38)
  [ 0,  0,  0, 26,  0,  0, 44, 44],  // 30 Infirmary  (T-1: 44)
  [ 0,  0, 26,  0,  0,  0, 45, 45],  // 31 Recreation room  (T-1: 45)
  [ 0,  0, 25,  0,  0,  0, 46, 47],  // 32 Mess hall  (T fix: 46-47)
  [ 0,  0,  0, 25,  0,  0, 49, 49],  // 33 Sleeping quarters  (T-1: 49)
  [ 0, 27,  0,  0,  0,  0, 48, 48],  // 34 Storage room  (T-1: 48)
  [ 0, 28,  0,  0, 24,  0, 52, 52],  // 35 Station control center  (T-1: 52)
  [ 0,  0, 28,  0,  0,  0, 53, 53],  // 36 Transporter room  (T-1: 53)
  [ 0,  0, 29,  0,  0,  0, 54, 54],  // 37 Laboratory  (T-1: 54)
  [29,  0, 39,  0,  0,  0, 55, 56],  // 38 Hanger area  (T-1: 55-56; needs O₂!)
  [40,  0,  0, 38,  0,  0, 57, 58],  // 39 Airlock (changing↔hanger)  (T-1: 57-58)
  [ 0, 39,  0, 29,  0,  0, 59, 59],  // 40 Space suit changing area  (T-1: 59)
  [ 0,  0,  0, 27, 42,  0, 50, 50],  // 41 Elevator – subsurface  (T-1: 50)
  [ 0,  0,  0, 28,  0, 41, 51, 51],  // 42 Elevator – surface  (T-1: 51)
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
  'Plato Crater Base',        // 11
  'Before Shed',              // 12
  'Shed Entrance',            // 13
  'Eastern Darkness',         // 14
  'Spacecraft Crash Site',    // 15
  'Ship Airlock 1',           // 16
  'Ship Airlock 2',           // 17
  'Aft Cargo / Fuel',         // 18
  'Engine Room',              // 19
  'Lower Spacecraft',         // 20
  'Control Room',             // 21
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

/** Locations that consume oxygen each turn (requires carrying oxygen module). */
function needsOxygen(p) {
  return (p >= 1 && p <= 18) || p === 38;
}

/** Locations where a power supply is required to survive. */
function needsPower(p) {
  return (p >= 1 && p <= 21) || p === 38;
}
