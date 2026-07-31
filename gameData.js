/**
 * gameData.js — SURVIVAL: Space Station Omega
 *
 * All static game-world data: rooms, items, messages, and configuration.
 * Game logic lives in game.js; this file is pure data.
 *
 * RECONSTRUCTION NOTES
 * ────────────────────
 * The original BASIC source and magazine article were used as design inputs.
 * Where OCR corruption or BASIC line-numbering made intent unclear, the most
 * plausible interpretation was chosen and marked with TODO comments.
 *
 * APPROVED GAMEPLAY ADJUSTMENTS (see README for full list):
 *   1. Dark-room safety: player can always retrace their entry step.
 *   2. Robot fairness: two-turn warning before the robot kills.
 *   3. Map reciprocals: all exit pairs are consistent.
 *   4. Resources raised: oxygen 120 (was ~80), power 100 (was ~60).
 *   5. Inventory raised: 6 slots (was 5).
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const GAME_CONFIG = {
  // Resources — slightly raised from originals per approved adjustments
  startingOxygen:    120,   // original ≈ 80–100
  startingPower:     100,   // original ≈ 60–80
  oxygenTankBoost:    30,   // units restored per oxygen tank
  powerCellBoost:     50,   // units restored per power cell

  // Inventory — slightly raised from original (5 → 6)
  inventoryLimit:      6,

  // Robot — approved fairness improvement
  robotWarningTurns:   2,   // turns of warning before robot kills player
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOMS
// ─────────────────────────────────────────────────────────────────────────────
//
// MAP OVERVIEW (schematic — north is "up"):
//
//   [25 OXYGEN BAY] ─ W─E ─ [05 W CORRIDOR] ─ W─E ─ [01 COMMAND CTR]
//                                 │ N─S                  │N  │E  │S  │W
//                            [13 STOR A]              [02]  [03] [04] [05]
//                            │N      │E                 │     │     │
//                           [12]  [14 STOR B]  (02 N─S 06)  (03 E─W 08)
//                           │W       │N                 │     │S
//                           [02]    [08 MED BAY]       [06] [09 LAB]
//                                   │W                  │N│E  │E
//                                  [03]                [07] [21] [15 DARK]
//                                                              │E
//         [22 DEACT] ─ W─E ─ [11 POWER] ─ N─S ─ [04]       [16 DARK]
//                                                              │S
//    [10 ENGINEERING] ─ W─E ─ [04]            [17 ROBOT ZONE]─N─[10]
//               │S                              │S  │E→[16]
//         [17 ROBOT ZONE]                      [18 ROBOT BASE EXT]
//               │S                              │S
//         [18 ROBOT BASE EXT]                  [19 ROBOT BASE ENTRY]
//               │S                              │S
//         [19 ROBOT BASE ENTRY]               [20 ROBOT CTRL]─E─[23 ESC CORR]
//               │S                                                  │S
//         [20 ROBOT CTRL] ─ E─W ─ [23 ESC CORR]               [24 ESC PODS]
//
// All exits are reciprocal (approved fix). See individual rooms for details.

const ROOMS = {

  1: {
    id: 1,
    name: 'Command Center',
    description:
      'You are in the command center of Space Station Omega. Emergency lighting ' +
      'casts a red glow across the banks of consoles. Every monitor displays ' +
      'ERROR or SYSTEM FAILURE. Corridors lead in all directions.',
    exits: { n: 2, e: 3, s: 4, w: 5 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  2: {
    id: 2,
    name: 'North Corridor',
    description:
      'A long corridor running north–south. Blast marks scar the walls. The ' +
      'airlock section lies to the north. A side passage leads east to the ' +
      'computer room.',
    exits: { s: 1, n: 6, e: 12 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  3: {
    id: 3,
    name: 'East Corridor',
    description:
      'The east corridor connects the research wing to the main hub. Sparking ' +
      'conduits hang from the ceiling. Passages lead west to the hub, east to ' +
      'the medical bay, and south to the laboratory.',
    exits: { w: 1, e: 8, s: 9 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  4: {
    id: 4,
    name: 'South Corridor',
    description:
      'The south corridor. Reactor-zone warning signs are posted everywhere. ' +
      'Passages branch west to engineering and south toward the power room.',
    exits: { n: 1, w: 10, s: 11 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  5: {
    id: 5,
    name: 'West Corridor',
    description:
      'The west corridor. Storage sections branch north. The emergency oxygen ' +
      'reserves bay lies to the west. The main hub is east.',
    exits: { e: 1, n: 13, w: 25 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  6: {
    id: 6,
    name: 'Airlock Antechamber',
    description:
      'The antechamber before the main airlock. Spacesuits hang in sealed lockers ' +
      'on the wall. A heavy pressure door leads north to the outer airlock. A ' +
      'passage east leads to the experimental transporter room.',
    exits: { s: 2, n: 7, e: 21 },
    items: ['spacesuit'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  7: {
    id: 7,
    name: 'Outer Airlock',
    description:
      'You are in the outer airlock chamber. Warning lights flash red. Through ' +
      'the thick viewport the stars are visible and the station hull gleams in ' +
      'starlight. A control panel reads: EXTERIOR HATCH — MANUAL OVERRIDE. ' +
      'The inner door is south.',
    // north is a special exit (death without spacesuit) — handled in game.js
    exits: { s: 6 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: 'outerAirlock',
  },

  8: {
    id: 8,
    name: 'Medical Bay',
    description:
      'The station medical bay. Overturned beds and scattered supplies suggest ' +
      'a hasty evacuation. A medical cabinet stands against the wall, partially ' +
      'ransacked. One sealed drawer remains untouched.',
    exits: { w: 3, s: 14 },
    items: ['medikit', 'accesscard'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  9: {
    id: 9,
    name: 'Research Laboratory',
    description:
      'The research laboratory. Banks of terminals still run on backup power. ' +
      'An experiment is mid-run, apparently abandoned. A dark, unlit passage ' +
      'leads east into the unilluminated section of the station.',
    exits: { n: 3, e: 15 },
    items: ['flashlight'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  10: {
    id: 10,
    name: 'Engineering Bay',
    description:
      'The engineering bay. Heavy machinery fills the room. Maintenance robots ' +
      'stand in their charging alcoves — inactive. Racks of tools line the walls.',
    exits: { e: 4, s: 17 },
    items: ['toolkit'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  11: {
    id: 11,
    name: 'Power Room',
    description:
      'The main power room. The reactor core hums at minimal output. The ' +
      'primary power cell is drained. Battery backups show 15%. A reinforced ' +
      'door to the east leads to the deactivation chamber.',
    exits: { n: 4, e: 22 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: 'powerRoom',
  },

  12: {
    id: 12,
    name: 'Computer Room',
    description:
      'Banks of processors hum on backup power. A security terminal displays ' +
      'RESTRICTED ACCESS. Station schematics glow on one monitor — a map of ' +
      'the escape pod bay is highlighted. A security station is on the wall.',
    exits: { w: 2, s: 13 },
    items: ['badge'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  13: {
    id: 13,
    name: 'Storage Room A',
    description:
      'Storage room A. Crates are stacked floor to ceiling; most have been ' +
      'pried open. A few sealed emergency crates remain. Passages lead north ' +
      'to the computer room, south to the west corridor, and east to storage B.',
    exits: { n: 12, s: 5, e: 14 },
    items: ['powercell'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  14: {
    id: 14,
    name: 'Storage Room B',
    description:
      'Storage room B — smaller than A, contents undisturbed. Emergency supply ' +
      'crates are strapped to the walls. Passages lead west to storage A and ' +
      'north to the medical bay.',
    exits: { w: 13, n: 8 },
    items: ['oxygentank'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  15: {
    id: 15,
    name: 'Dark Passage',
    description:
      'A passage leading into the unlit section of the station. The emergency ' +
      'lighting has failed completely here. Without a light source you can ' +
      'barely make out anything.',
    exits: { w: 9, e: 16 },
    items: [],
    dark: true,
    robotPatrol: false,
    special: null,
  },

  16: {
    id: 16,
    name: 'Dark Chamber',
    description:
      'A chamber deep in the unlit section. In the darkness the room feels ' +
      'vast. Something lies on the floor nearby. A passage continues east.',
    // FIX: original had inconsistent exits here (OCR/BASIC ambiguity).
    // Corrected so the dark section runs as a W-E chain: Lab─15─16─17,
    // matching the reciprocal requirement and the map schematic.
    exits: { w: 15, e: 17 },
    items: ['keycard'],
    dark: true,
    robotPatrol: false,
    special: null,
  },

  17: {
    id: 17,
    name: 'Robot Patrol Zone',
    description:
      'A wide corridor that marks the boundary of the security robot\'s patrol ' +
      'territory. Deep wheel tracks are worn into the metal floor. Signs read: ' +
      'SECURITY ZONE — AUTHORIZED PERSONNEL ONLY. An unlit passage leads west.',
    // FIX: exit west→16 replaces the original ambiguous east/south dark-room link.
    exits: { n: 10, w: 16, s: 18 },
    items: [],
    dark: false,
    robotPatrol: true,
    special: null,
  },

  18: {
    id: 18,
    name: 'Robot Base Exterior',
    description:
      'The exterior of the robot command base. Heavy blast doors seal most ' +
      'entrances. Warning lights flash red. A reinforced door south is marked ' +
      'SECURITY CONTROL — AUTHORIZED ACCESS ONLY.',
    exits: { n: 17, s: 19 },
    items: [],
    dark: false,
    robotPatrol: true,
    special: null,
  },

  19: {
    id: 19,
    name: 'Robot Base Entry',
    description:
      'The entry corridor of the robot base. The air smells of machine oil ' +
      'and ozone. Security cameras track your every move. Doors lead north ' +
      'and south.',
    exits: { n: 18, s: 20 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  20: {
    id: 20,
    name: 'Robot Control Room',
    description:
      'The robot control room. A master console displays status for all ' +
      'security units: ROBOT ALPHA — ACTIVE / PATROL MODE. Emergency override ' +
      'tools are scattered on the workbench. A passage east leads out.',
    exits: { n: 19, e: 23 },
    items: ['deactivator'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  21: {
    id: 21,
    name: 'Transporter Room',
    description:
      'The station\'s experimental transporter room. A glowing platform in the ' +
      'center pulses with faint energy. A control panel lists available ' +
      'destinations. The system needs both power and an authorization keycard ' +
      'to operate.',
    exits: { w: 6 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: 'transporter',
  },

  22: {
    id: 22,
    name: 'Deactivation Chamber',
    description:
      'A reinforced chamber for handling dangerous materials. In the center, ' +
      'on a heavy pedestal, sits a device with a blinking red light. It is ' +
      'clearly an explosive. The trigger mechanism appears armed and waiting.',
    exits: { w: 11 },
    items: ['bomb'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  23: {
    id: 23,
    name: 'Escape Corridor',
    description:
      'The escape corridor leading to the emergency pods. Red and amber lights ' +
      'flash in sequence. Signs point south: ESCAPE PODS — EMERGENCY USE ONLY. ' +
      'A passage west leads back into the robot base area.',
    exits: { w: 20, s: 24 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: null,
  },

  24: {
    id: 24,
    name: 'Escape Pod Bay',
    description:
      'The escape pod bay! Six bays line the walls; three pods have already ' +
      'launched. A fourth pod sits ready, console lights blinking green. ' +
      'This is your way off the station. Insert an authorized access card ' +
      'to launch.',
    exits: { n: 23 },
    items: [],
    dark: false,
    robotPatrol: false,
    special: 'escapePod',
  },

  25: {
    id: 25,
    name: 'Oxygen Reserves Bay',
    description:
      'The emergency oxygen reserves bay. Rows of pressurized tanks are ' +
      'secured to the walls under green-labeled emergency lighting. Station ' +
      'protocol keeps these sealed for life-support backup.',
    exits: { e: 5 },
    items: ['oxygentank2'],
    dark: false,
    robotPatrol: false,
    special: null,
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────────────────────────────────────
//
// Fields:
//   id          — string key (matches key in ITEMS and in room.items arrays)
//   name        — display name
//   keywords    — words a player can type to refer to this item
//   description — shown by EXAMINE
//   portable    — can the player pick it up?
//   weight      — inventory slots used (total limit = GAME_CONFIG.inventoryLimit)
//   useEffect   — string tag consumed by the USE handler in game.js (null = generic)
//   useMessage  — printed on successful generic USE (null = handled specially)
//   useFailMsg  — printed when USE conditions are not met

const ITEMS = {

  badge: {
    id: 'badge',
    name: 'Security Badge',
    keywords: ['badge', 'security', 'id', 'identification', 'pass'],
    description:
      'A crew security badge bearing your photo and Level-3 clearance. The ' +
      'station robot security system recognises this badge and will not engage ' +
      'authorized personnel.',
    portable: true,
    weight: 1,
    useEffect: null,
    useMessage:
      'You hold up the security badge. The robot sensors scan it and acknowledge ' +
      'your authorization.',
    useFailMsg: null,
  },

  flashlight: {
    id: 'flashlight',
    name: 'Flashlight',
    keywords: ['flashlight', 'flash', 'light', 'torch', 'lamp'],
    description:
      'A heavy-duty battery-powered flashlight. Essential for navigating the ' +
      'unlit sections of the station.',
    portable: true,
    weight: 1,
    useEffect: 'light',
    useMessage: 'You switch on the flashlight. Its beam cuts through the darkness.',
    useFailMsg: null,
  },

  oxygentank: {
    id: 'oxygentank',
    name: 'Oxygen Tank',
    keywords: ['oxygen', 'tank', 'o2', 'air', 'oxy', 'canister'],
    description:
      'An emergency oxygen tank. Connecting this to your suit coupling will ' +
      'extend your air supply by 30 units.',
    portable: true,
    weight: 2,
    useEffect: 'oxygen',
    useMessage: 'You connect the oxygen tank. Air supply extended by 30 units.',
    useFailMsg: null,
  },

  oxygentank2: {
    id: 'oxygentank2',
    name: 'Oxygen Tank',
    keywords: ['oxygen', 'tank', 'o2', 'air', 'oxy', 'canister'],
    description:
      'An emergency oxygen tank. Connecting this to your suit coupling will ' +
      'extend your air supply by 30 units.',
    portable: true,
    weight: 2,
    useEffect: 'oxygen',
    useMessage: 'You connect the oxygen tank. Air supply extended by 30 units.',
    useFailMsg: null,
  },

  powercell: {
    id: 'powercell',
    name: 'Power Cell',
    keywords: ['power', 'cell', 'battery', 'powercell', 'fuel'],
    description:
      'A fully charged emergency power cell. Installing this in the reactor ' +
      'will restore station power and bring the transporter online.',
    portable: true,
    weight: 2,
    useEffect: 'power',
    useMessage: null,                        // handled specially in cmdUse
    useFailMsg:
      'You need to be in the Power Room to install the power cell in the reactor.',
  },

  spacesuit: {
    id: 'spacesuit',
    name: 'Spacesuit',
    keywords: ['spacesuit', 'suit', 'space', 'vac', 'vacuum', 'eva'],
    description:
      'A full EVA spacesuit. Required to survive exposure to vacuum. The ' +
      'seals appear intact.',
    portable: true,
    weight: 3,
    useEffect: 'suit',
    useMessage: 'You put on the spacesuit. You are now protected against vacuum.',
    useFailMsg: null,
  },

  medikit: {
    id: 'medikit',
    name: 'Medical Kit',
    keywords: ['medikit', 'medical', 'med', 'kit', 'aid', 'first'],
    description:
      'A standard station medical kit. Contains emergency bandages, stimulants, ' +
      'and basic surgical tools.',
    portable: true,
    weight: 1,
    useEffect: null,
    useMessage: 'You treat your minor injuries with the medical kit.',
    useFailMsg: null,
  },

  toolkit: {
    id: 'toolkit',
    name: 'Tool Kit',
    keywords: ['toolkit', 'tool', 'tools', 'kit', 'wrench', 'spanner'],
    description:
      'A comprehensive engineering tool kit. Contains wrenches, drivers, and ' +
      'diagnostic equipment for station maintenance.',
    portable: true,
    weight: 2,
    useEffect: 'repair',
    useMessage:
      'You attempt some field repairs. Nothing critical changes, but a few ' +
      'sparking conduits are now less of a hazard.',
    useFailMsg: null,
  },

  accesscard: {
    id: 'accesscard',
    name: 'Access Card',
    keywords: ['access', 'card', 'level', 'clearance', 'swipe'],
    description:
      'A station access card with Level-3 clearance. Can activate restricted ' +
      'station systems — including emergency escape pods.',
    portable: true,
    weight: 1,
    useEffect: 'access',
    useMessage: null,                        // handled specially in cmdUse
    useFailMsg: null,
  },

  keycard: {
    id: 'keycard',
    name: 'Key Card',
    keywords: ['keycard', 'key', 'card', 'transport'],
    description:
      'A keycard found in the dark section. Encoded for the station transporter ' +
      'system.',
    portable: true,
    weight: 1,
    useEffect: 'transport',
    useMessage: null,                        // handled specially in cmdUse
    useFailMsg:
      'This keycard is encoded for the transporter system. Use it there.',
  },

  bomb: {
    id: 'bomb',
    name: 'Bomb',
    keywords: ['bomb', 'explosive', 'device', 'timer', 'charge'],
    description:
      'An armed explosive device. The trigger mechanism is active. The escape ' +
      'pod will not launch while this is armed anywhere on the station. It MUST ' +
      'be deactivated.',
    portable: true,
    weight: 3,
    useEffect: null,
    useMessage:
      'You examine the bomb carefully. Without a deactivator you cannot safely ' +
      'disarm it.',
    useFailMsg: null,
  },

  deactivator: {
    id: 'deactivator',
    name: 'Deactivator',
    keywords: ['deactivator', 'deact', 'remote', 'disarm', 'override'],
    description:
      'A remote deactivation unit from the robot control room. Originally ' +
      'designed to shut down rogue robots; it can also disarm explosive devices.',
    portable: true,
    weight: 1,
    useEffect: 'deactivate',
    useMessage: null,                        // handled specially in cmdUse
    useFailMsg: 'There is nothing here to deactivate.',
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGES = {

  welcome: [
    '╔══════════════════════════════════════════════════════════╗',
    '║               S  U  R  V  I  V  A  L                    ║',
    '║            Space Station Omega — Emergency               ║',
    '╚══════════════════════════════════════════════════════════╝',
    '',
    'You regain consciousness. Emergency alarms blare. The red glow',
    'of backup lighting fills the Command Center of Space Station Omega.',
    '',
    'An explosion has crippled the station. Most crew have evacuated.',
    'Your oxygen supply is limited. A malfunctioning security robot',
    'still patrols the lower decks. Someone has planted a bomb.',
    '',
    'You must reach the escape pods before your oxygen runs out.',
    '',
    'Type HELP for a list of commands, or press a direction button to move.',
  ].join('\n'),

  help: [
    'COMMANDS',
    '────────────────────────────────────────────',
    'NORTH / N          Move north',
    'SOUTH / S          Move south',
    'EAST  / E          Move east',
    'WEST  / W          Move west',
    'LOOK  / L          Describe current room',
    'EXAMINE / X [item] Examine an item',
    'GET / TAKE [item]  Pick up an item',
    'DROP [item]        Drop an item',
    'USE [item]         Use an item',
    'INVENTORY / I      List what you carry',
    'HELP / ?           This message',
    'RESTART            Start a new game',
    '',
    'TIPS',
    '────────────────────────────────────────────',
    '- Watch your OXYGEN — it drops every turn.',
    '- Dark areas require a light source.',
    '- The security robot is dangerous — carry your badge.',
    '- Some items only work in specific locations.',
  ].join('\n'),

  // Death
  dieOxygen:
    'Your oxygen supply reaches zero. You slump to the floor as ' +
    'darkness closes in.\n\n*** GAME OVER — YOU RAN OUT OF OXYGEN ***',

  diePower:
    'Station power collapses completely. Every light goes out. In the ' +
    'crushing darkness you cannot survive.\n\n*** GAME OVER — POWER FAILURE ***',

  dieRobot:
    'The security robot catches you. Its weapons system activates. ' +
    'You do not survive the encounter.\n\n*** GAME OVER — TERMINATED BY ROBOT ***',

  dieSpace:
    'You open the outer hatch without a spacesuit. The vacuum of space ' +
    'is instantly fatal.\n\n*** GAME OVER — KILLED BY VACUUM ***',

  // Win
  win: [
    'You slide the access card into the escape pod launch console.',
    'Green lights cascade across the panel. The launch sequence initiates.',
    '',
    'With a tremendous roar the pod is ejected from Station Omega.',
    '',
    'Through the viewport you watch the crippled station recede into',
    'the darkness of space. You have survived.',
    '',
    '*** CONGRATULATIONS — YOU ESCAPED FROM SPACE STATION OMEGA! ***',
  ].join('\n'),

  // Robot warnings
  robotWarning1:
    'ALERT: The security robot has spotted an unauthorized presence! ' +
    'Leave this area immediately or face termination!',
  robotWarning2:
    'FINAL WARNING: The security robot is targeting you! ' +
    'Leave NOW or you will be destroyed!',

  // Dark rooms
  darkNoLight:
    'It is pitch dark. You cannot see anything. You need a light source to ' +
    'explore this area safely.',
  darkWithLight: '(Your flashlight illuminates the area.)',

  // Transporter
  transporterNoPower:
    'The transporter platform is dark and silent. It requires full station ' +
    'power to operate. Restore power first.',
  transporterNoKey:
    'The transporter control panel flashes: KEYCARD REQUIRED. You need an ' +
    'authorization keycard to set a destination.',
  transporterActivating:
    'You insert the keycard. The platform hums to life. Destination locked...',
  transporterArrival:
    'In a flash of blue-white light you are transported to another part of ' +
    'the station.',

  // Power room
  powerRestored:
    'You install the power cell into the reactor coupling. A deep hum ' +
    'vibrates through the floor. Station power rises to 75%. Emergency ' +
    'lighting flares brighter throughout the station. The transporter is ' +
    'now operational.',
  powerAlreadyRestored: 'The power cell has already been installed in the reactor.',

  // Bomb / deactivator
  bombDeactivated:
    'You aim the deactivator at the bomb and activate the override sequence. ' +
    'The red light blinks rapidly — then goes dark. The bomb is safely ' +
    'deactivated. A wave of relief washes over you.',
  bombAlreadyDeactivated: 'The bomb has already been deactivated.',
  bombNoBomb:
    'There is no armed explosive device here.',
  bombMustCarry:
    'You need to be carrying the bomb to deactivate it, or use the deactivator ' +
    'in the room where the bomb is located.',

  // Escape pod
  escapePodBombActive:
    'The pod launch system detects an armed explosive on the station. ' +
    'The launch is locked until the threat is neutralized. Deactivate the ' +
    'bomb first.',
  escapePodNoCard:
    'The escape pod console reads: INSERT AUTHORIZED ACCESS CARD TO LAUNCH. ' +
    'You do not have an access card.',
  escapePodLaunching:
    'You insert the access card...',

  // Airlock
  airlockSuitOk:
    'Wearing your spacesuit, you open the outer hatch. The void of space ' +
    'stretches before you. There is nothing to do out here — you return inside.',
  airlockNoSuit:
    'You reach for the outer hatch control but stop yourself. Without a ' +
    'spacesuit, opening that hatch would be instantly fatal.',
};

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION TABLES
// ─────────────────────────────────────────────────────────────────────────────

// Normalise player input to a single-letter direction key
const DIR_ALIASES = {
  n: 'n', north: 'n',
  s: 's', south: 's',
  e: 'e', east:  'e',
  w: 'w', west:  'w',
  u: 'u', up:    'u',
  d: 'd', down:  'd',
};

// Full display names for directions
const DIR_DISPLAY = {
  n: 'North', s: 'South', e: 'East', w: 'West', u: 'Up', d: 'Down',
};

// Opposite of each direction (used for safe dark-room backtrack)
const DIR_OPPOSITE = {
  n: 's', s: 'n', e: 'w', w: 'e', u: 'd', d: 'u',
};
