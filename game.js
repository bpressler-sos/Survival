/**
 * game.js — SURVIVAL (Moon Survival)
 *
 * Faithful JavaScript port of the 1981 BASIC text adventure by Stewart Rush.
 * All static world data is in gameData.js (must load first).
 *
 * ── How the BASIC loop maps to JavaScript ───────────────────────────────────
 *  Each "turn" calls beginTurn(), which:
 *    1. Prints elapsed time and resource levels
 *    2. Increments t1 by 5, drains power/oxygen
 *    3. Checks power failure / time-limit deaths
 *    4. Handles timed world events (expose deactivator, bomb, asteroid)
 *    5. Checks oxygen-death conditions
 *    6. Prints location description and items present
 *    7. Runs robot movement logic
 *  After beginTurn() the engine waits for player input (processInput).
 *
 * ── Obstacle mechanic ───────────────────────────────────────────────────────
 *  When a movement encounters a locked/dangerous barrier the engine sets
 *  GS.obstacle = { requiredItem, onSuccess, onFail }, mirroring the BASIC
 *  "TRY/USE" subroutine at line 4890. The *next* player input is intercepted:
 *  "use/try <item>" with the right item calls onSuccess, anything else calls
 *  onFail. Obstacle mode always ends after one attempt, so the player can
 *  never be trapped in it.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────────────────────────────

// ── All mutable game state (var so browser devtools and tests can inspect it)
var GS = {};

function initGame() {
  GS = {
    p:  1,      // current location
    r:  1,      // previous location
    t1: 0,      // elapsed time (minutes) — incremented BEFORE display
    t2: 205,    // oxygen remaining (minutes)
    p1: 230,    // power unit charge
    p2: 150,    // power pack charge
    v:  0,      // computer terminal reads
    c:  2,      // items carried  (starts 2: oxygen module + power unit)

    // Flags (all 0=off / 1=on unless noted)
    f0: 1,  // oxygen in use (1=consuming, 0=not)
    f1: 0,  // shed unlocked
    f2: 0,  // meteor shower survived
    f3: 0,  // laser deflected
    f4: 0,  // ventilator shaft illuminated
    f5: 0,  // deactivator exposed (placed at loc 14)
    f7: 0,  // bomb deactivated
    f9: 0,  // air seal blown (oxygen req'd everywhere)

    o: O_INIT.slice(),           // object locations (1-indexed)
    m: M_INIT.map(r => r ? r.slice() : null), // movement matrix (mutable)

    obstacle: null,  // pending obstacle: { requiredItem, onSuccess, onFail }
    gameOver: false,
    won:      false,

    inputHistory: [],
    historyIndex: -1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────────────────────────────────────

let elTranscript, elInput, elO2, elPower, elTime, elLocation,
    elInventoryList, elRoomList, elDirButtons;

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function printOutput(text, cls) {
  const cssClass = cls || 'msg-normal';
  const div = document.createElement('div');
  div.className = 'output-line ' + cssClass;
  text.split('\n').forEach((line, i) => {
    if (i > 0) div.appendChild(document.createElement('br'));
    div.appendChild(document.createTextNode(line));
  });
  elTranscript.appendChild(div);
  elTranscript.scrollTop = elTranscript.scrollHeight;
}

function printBlank() {
  const div = document.createElement('div');
  div.className = 'output-line';
  div.innerHTML = '&nbsp;';
  elTranscript.appendChild(div);
}

function printHR() {
  const hr = document.createElement('hr');
  hr.className = 'transcript-hr';
  elTranscript.appendChild(hr);
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD & SIDEBAR UPDATES
// ─────────────────────────────────────────────────────────────────────────────

function updateHUD() {
  // Oxygen
  if (GS.f0 === 1) {
    elO2.textContent = 'O\u2082: ' + GS.t2 + ' min';
    elO2.classList.toggle('hud-warn', GS.t2 <= 20);
  } else {
    elO2.textContent = 'O\u2082: ---';
    elO2.classList.remove('hud-warn');
  }

  // Power
  if (GS.o[11] === 99) {
    elPower.textContent = 'PWR: ' + GS.p1 + 'u';
    elPower.classList.toggle('hud-warn', GS.p1 <= 30);
  } else if (GS.o[14] === 99) {
    elPower.textContent = 'PKT: ' + GS.p2 + 'u';
    elPower.classList.toggle('hud-warn', GS.p2 <= 10);
  } else {
    elPower.textContent = 'PWR: ---';
    elPower.classList.remove('hud-warn');
  }

  // Time
  elTime.textContent = 'TIME: ' + GS.t1 + ' min';

  // Location
  elLocation.textContent = LOC_NAME[GS.p] || ('Loc ' + GS.p);
}

function updateDirButtons() {
  const row = GS.m[GS.p];
  const dirs = ['n','s','e','w','u','d'];
  const idx  = [0,  1,  2,  3,  4,  5];
  dirs.forEach((d, i) => {
    const btn = document.getElementById('btn-' + d);
    if (!btn) return;
    const dest = row ? row[idx[i]] : 0;
    btn.disabled = (dest === 0);
    btn.classList.toggle('dir-death', dest === 99);
  });
}

function updateInventory() {
  elInventoryList.innerHTML = '';
  let count = 0;
  for (let i = 1; i <= 14; i++) {
    if (GS.o[i] === 99) {
      count++;
      const li = document.createElement('li');
      li.className = 'item-entry';
      li.textContent = ITEM_NAME[i];
      li.title = 'Drop ' + ITEM_NAME[i];
      li.addEventListener('click', () => {
        if (!GS.gameOver && !GS.obstacle) processInput('drop ' + ITEM_NAME[i].replace(/^(an?|the)\s+/i, ''));
      });
      elInventoryList.appendChild(li);
    }
  }
  const cap = document.getElementById('inv-capacity');
  if (cap) cap.textContent = count + ' / 4 items';
}

function updateRoomItems() {
  elRoomList.innerHTML = '';
  for (let i = 1; i <= 14; i++) {
    if (GS.o[i] === GS.p) {
      const li = document.createElement('li');
      li.className = 'item-entry';
      li.textContent = ITEM_NAME[i];
      // Items that cannot be picked up
      if (i === 5) {
        li.title = 'A robot (cannot carry)';
        li.classList.add('item-noget');
      } else if (i === 10) {
        li.title = 'Read the computer message (use READ command)';
        li.classList.add('item-noget');
      } else {
        li.title = 'Take ' + ITEM_NAME[i];
        li.addEventListener('click', () => {
          if (!GS.gameOver && !GS.obstacle) processInput('get ' + ITEM_NAME[i].replace(/^(an?|the)\s+/i, ''));
        });
      }
      elRoomList.appendChild(li);
    }
  }
}

function updateUI() {
  updateHUD();
  updateDirButtons();
  updateInventory();
  updateRoomItems();
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a command string containing a noun (e.g. "get electronic key"),
 * returns the item index (1-14) or 0 if unrecognised.
 * Matches the first 3 letters of the last "word group" after the verb.
 */
function parseItem(input) {
  const s = input.trim().toLowerCase();
  const spaceIdx = s.indexOf(' ');
  if (spaceIdx === -1) return 0;
  const noun = s.slice(spaceIdx + 1).trim();
  if (!noun) return 0;
  // Try each word in the noun phrase (skip articles); return first match
  const words = noun.split(/\s+/);
  for (const w of words) {
    if (w === 'a' || w === 'an' || w === 'the') continue;
    const id = ITEM_KEYS[w.slice(0, 3)];
    if (id) return id;
  }
  return 0;
}

/** Returns true if the player is carrying item i. */
function carrying(i) { return GS.o[i] === 99; }

// ─────────────────────────────────────────────────────────────────────────────
// TURN ENTRY POINT  (called every time we need to display a location)
// ─────────────────────────────────────────────────────────────────────────────

function beginTurn() {
  // ── 1. Print elapsed time and resource levels ──────────────────────────────
  printBlank();
  printOutput('Elapsed time: ' + GS.t1 + ' minutes.', 'msg-system');
  if (carrying(11)) printOutput('Power unit: ' + GS.p1 + ' units.', 'msg-system');
  if (carrying(14)) printOutput('Power pack: ' + GS.p2 + ' units.', 'msg-system');

  // ── 2. Advance time and drain resources ────────────────────────────────────
  GS.t1 += 5;
  // BASIC 690/700 drain a supply only while it holds more than 5 units, so a
  // small reserve always remains. Draining to exactly 0 (as the Big Computer
  // Games listing does) makes the game unwinnable, because the spare power
  // pack sits behind the laser deep inside the space station.
  if (carrying(11) && GS.p1 > 5) GS.p1 -= 5;
  if (carrying(14) && GS.p2 > 5) GS.p2 -= 5;

  // ── 3. Check power failure (BASIC 710/720 → 3680) ─────────────────────────
  // Running out of power is only fatal where warmth is needed: on the surface
  // and in the wrecked ship (p < 22), or anywhere once the seal is blown.
  if ((carrying(11) && GS.p1 === 0) || (carrying(14) && GS.p2 === 0)) {
    if (powerFatal(GS.p, GS.f9)) { powerFailure(); return; }
  }

  // ── 4. Timed world events ──────────────────────────────────────────────────
  if (GS.t1 > 400) { asteroidDeath(); return; }

  if (GS.t1 > 350) {
    if (GS.f7 === 0) { bombDetonation(); return; }
    // Bomb already deactivated — continue
  }

  if (GS.t1 > 200 && GS.f5 === 0) {
    exposeDeactivator();
  }

  // ── 5. Oxygen drain and death checks (BASIC 760-830) ──────────────────────
  if (GS.f0 === 1) {
    GS.t2 -= 5;
    if (GS.t2 < 0) GS.t2 = 0;
  }

  // Breathing checks only matter when no oxygen is being consumed: either the
  // module was dropped (f0 = 0) or the supply has run out.
  if (GS.f0 === 0 || GS.t2 <= 0) {
    // Seal blown: every station location needs oxygen (BASIC 800/810)
    if (GS.f9 === 1 && GS.p > 21) { oxygenDeath(); return; }
    // Moon surface always needs oxygen (BASIC 820)
    if (needsOxygen(GS.p)) { oxygenDeath(); return; }
    // The hanger holds air only if it was entered through its air lock
    // (BASIC 830 → 1700)
    if (GS.p === 38 && GS.r !== 39) { oxygenDeath(); return; }
  }

  // ── 6. Blown seal when the hanger is entered from the corridor (BASIC 3590)
  if (GS.p === 38 && GS.r === 29 && GS.f9 === 0) {
    GS.f9 = 1;
    printOutput('You have just blown the air seal of the space station!', 'msg-warn');
    printOutput('The station is now losing pressure. Oxygen is required everywhere.', 'msg-warn');
  }

  // ── 7. Display location ────────────────────────────────────────────────────
  if (GS.f0 === 1) {
    printOutput('Oxygen remaining: ' + GS.t2 + ' minutes.', 'msg-system');
  }

  printOutput('Present location:', 'msg-location-hdr');
  const row = GS.m[GS.p];
  for (let i = row[6]; i <= row[7]; i++) {
    if (T[i]) printOutput(T[i], 'msg-location');
  }
  printHR();

  // ── 8. Handle overlook: auto-drop illuminator ──────────────────────────────
  if (GS.p === 2 && carrying(4)) {
    GS.o[4] = 100; // lost forever (location 100 = off-map)
    GS.c--;
    printOutput('You dropped your illuminator over the edge!', 'msg-warn');
    printOutput('You cannot retrieve it.', 'msg-warn');
  }

  // ── 9. Display items at location ──────────────────────────────────────────
  for (let i = 1; i <= 14; i++) {
    if (GS.o[i] === GS.p) {
      printOutput('There is ' + ITEM_NAME[i] + ' here.', 'msg-item');
    }
  }

  // ── 10. Robot logic ────────────────────────────────────────────────────────
  robotTick();

  updateUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// ROBOT MOVEMENT
// ─────────────────────────────────────────────────────────────────────────────

function robotTick() {
  const robot = 5;
  const rLoc  = GS.o[robot];

  // Robot patrol movement (runs every turn)
  if      (rLoc === 28) GS.o[robot] = 35;
  else if (rLoc === 42) GS.o[robot] = 28;
  else if (rLoc === 41) GS.o[robot] = 42;
  else if (rLoc === 27) GS.o[robot] = 41;
  else if (rLoc === 25) GS.o[robot] = 27;

  // Robot at control center: open north exit from corridor 28
  if (GS.o[robot] === 35) {
    if (GS.p === 28) {
      GS.m[28][0] = 35; // north from corridor 28 → control center
    }
  }

  // Robot at loc 32 (initial): reacts to player entering
  if (GS.o[robot] === 32 && GS.p === 32) {
    if (carrying(13)) {
      // Badge recognised: robot starts patrol, no attack
      GS.o[robot] = 25;
      printOutput('The robot scans your coded badge and steps aside.', 'msg-normal');
    } else {
      printOutput('The robot fails to recognise you.', 'msg-warn');
      printOutput('It fires a phasor weapon at you!', 'msg-warn');
      gameDeath('You have been vaporised by the robot.');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMED WORLD EVENTS
// ─────────────────────────────────────────────────────────────────────────────

function exposeDeactivator() {
  GS.f5 = 1;
  // Place deactivator at loc 14 (dark area east of Posidonius)
  GS.o[6] = 14;
  // Open west exit from loc 14 → loc 2 (so the player can get back out)
  GS.m[14][3] = 2;
  // The darkness lifts: drop the final "total darkness" line of locs 2 and 14
  // (BASIC 3760/3770 set M(2,8)=M(2,7) and M(14,8)=M(14,7))
  GS.m[2][7]  = GS.m[2][7] - 1;   // loc 2 keeps its first two lines
  GS.m[14][7] = GS.m[14][6];      // loc 14 keeps "Somewhere east of Mare Serenitatis."
  printOutput('[A faint signal from the east has been detected.]', 'msg-system');
}

function bombDetonation() {
  printOutput('A nuclear detonation has just occurred.', 'msg-bad');
  gameDeath(null);
}

function asteroidDeath() {
  printOutput('The moon base has just been destroyed by a large asteroid.', 'msg-bad');
  gameDeath(null);
}

function powerFailure() {
  printOutput('You have no power or power pack.', 'msg-bad');
  printOutput('You have frozen to death.', 'msg-bad');
  gameDeath(null);
}

function oxygenDeath() {
  printOutput('Oxygen required here. None available.', 'msg-bad');
  gameDeath(null);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEATH / WIN
// ─────────────────────────────────────────────────────────────────────────────

function gameDeath(extraMsg) {
  if (extraMsg) printOutput(extraMsg, 'msg-bad');
  printOutput('You have failed to survive.', 'msg-bad');
  GS.gameOver = true;
  updateUI();
  printBlank();
  printOutput('Press RESTART to try again.', 'msg-system');
}

function gameWin() {
  GS.won = true;
  GS.gameOver = true;
  printOutput('Congratulations! You have just blasted off', 'msg-good');
  printOutput('and are on your way to Earth.', 'msg-good');
  printOutput('Your escape time: ' + GS.t1 + ' minutes.', 'msg-good');
  printBlank();
  printOutput('Press RESTART to play again.', 'msg-system');
  updateUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/** Handle movement in direction d (0=N,1=S,2=E,3=W,4=U,5=D). */
function cmdMove(dirIdx) {
  const row  = GS.m[GS.p];
  const dest = row[dirIdx];

  if (!dest) {
    printOutput("You can't go in that direction.", 'msg-warn');
    return;
  }

  if (dest === 99) {
    printOutput('You have fallen to your death.', 'msg-bad');
    gameDeath(null);
    return;
  }

  // ── Special movement checks (BASIC lines 1180-1220) ──────────────────────

  // Meteor shower: leaving loc 12 going west to loc 13
  if (GS.p === 12 && dest === 13 && GS.f2 === 0) {
    printOutput('There is a meteor shower.', 'msg-warn');
    printOutput('Your space suit has developed a leak...', 'msg-warn');
    printOutput('Try to seal it with something you carry. (Use: USE SEALANT)', 'msg-warn');
    GS.obstacle = {
      requiredItem: 2,
      onSuccess: () => {
        printOutput('Your suit is now sealed.', 'msg-good');
        GS.f2 = 1;
        doMove(dest);
      },
      onFail: () => {
        printOutput('Your suit loses pressure.', 'msg-bad');
        gameDeath('You have suffocated.');
      },
    };
    return;
  }

  // Locked shed: leaving loc 13 going west to loc 22
  if (GS.p === 13 && dest === 22 && GS.f1 === 0) {
    printOutput('The shed is locked!', 'msg-warn');
    printOutput('You need something to open it. (Use: USE KEY)', 'msg-warn');
    GS.obstacle = {
      requiredItem: 1,
      onSuccess: () => {
        printOutput('You are in the shed air lock.', 'msg-good');
        GS.f1 = 1;
        doMove(dest);
      },
      onFail: () => {
        printOutput('Your attempt fails.', 'msg-warn');
        // Non-fatal: the shed stays locked and the player keeps playing
        updateUI();
      },
    };
    return;
  }

  // Dark ventilator shaft: leaving loc 22 going down to loc 23
  if (GS.p === 22 && dest === 23 && GS.f4 === 0) {
    printOutput('It is dangerous to proceed in the dark.', 'msg-warn');
    printOutput('You need a light source. (Use: USE ILLUMINATOR)', 'msg-warn');
    GS.obstacle = {
      requiredItem: 4,
      onSuccess: () => {
        printOutput('The shaft is now illuminated.', 'msg-good');
        GS.f4 = 1;
        doMove(dest);
      },
      onFail: () => {
        printOutput('You plunge into the darkness.', 'msg-bad');
        gameDeath('You have fallen to your death.');
      },
    };
    return;
  }

  // Shaft darkness check: any movement from loc 23 requires illuminator
  if (GS.p === 23 && !carrying(4)) {
    printOutput('Without your illuminator you cannot navigate the shaft.', 'msg-bad');
    gameDeath('You have fallen to your death.');
    return;
  }

  // Laser beam: leaving loc 29 going west to loc 37
  if (GS.p === 29 && dest === 37 && GS.f3 === 0) {
    printOutput('There is a laser beam here. Passage is not possible with the beam present.', 'msg-warn');
    printOutput('You need something to deflect it. (Use: USE MIRROR)', 'msg-warn');
    GS.obstacle = {
      requiredItem: 12,
      onSuccess: () => {
        printOutput('The beam is now deflected.', 'msg-good');
        GS.f3 = 1;
        doMove(dest);
      },
      onFail: () => {
        printOutput('You have been zapped by the laser.', 'msg-bad');
        gameDeath(null);
      },
    };
    return;
  }

  doMove(dest);
}

function doMove(dest) {
  GS.r = GS.p;
  GS.p = dest;
  beginTurn();
}

/** GET / TAKE / KEEP */
function cmdGet(input) {
  const i = parseItem(input);

  if (!i) {
    const noun = input.slice(input.indexOf(' ') + 1).trim();
    if (!noun) { printOutput('Get what?', 'msg-warn'); return; }
    printOutput("I don't recognise '" + noun + "'.", 'msg-warn');
    return;
  }

  if (GS.o[i] !== GS.p) {
    const noun = input.slice(input.indexOf(' ') + 1).trim();
    printOutput('There is no ' + noun + ' here!', 'msg-warn');
    return;
  }

  // Special items
  if (i === 5)  { printOutput("You can't carry a robot!", 'msg-warn'); return; }
  if (i === 10) { printOutput("You can't get the message; it's on the terminal screen.", 'msg-warn'); return; }

  // Carry limit: 6 items max (BASIC: c > 3)
  if (GS.c >= 6) { printOutput("You can't carry any more!", 'msg-warn'); return; }

  // Power supply: can only carry one at a time
  if (i === 11) {
    if (carrying(14)) { printOutput("You can't have more than one power supply.", 'msg-warn'); return; }
  }
  if (i === 14) {
    if (carrying(11)) { printOutput("You can't have more than one power supply.", 'msg-warn'); return; }
  }

  GS.o[i] = 99;
  GS.c++;
  if (i === 3) GS.f0 = 1; // picking up oxygen module activates it
  printOutput('OK.', 'msg-good');
  updateUI();
}

/** DROP / LEAVE / PUT */
function cmdDrop(input) {
  const i = parseItem(input);

  if (!i) {
    const noun = input.slice(input.indexOf(' ') + 1).trim();
    if (!noun) { printOutput('Drop what?', 'msg-warn'); return; }
    printOutput("I don't recognise '" + noun + "'.", 'msg-warn');
    return;
  }

  if (!carrying(i)) {
    const noun = input.slice(input.indexOf(' ') + 1).trim();
    printOutput("You don't have " + noun + '!', 'msg-warn');
    return;
  }

  // Dropping a power supply on the surface or with blown seal = death
  if (i === 11 || i === 14) {
    if (needsPower(GS.p)) {
      printOutput('You need power here! You cannot drop your power supply.', 'msg-warn');
      printOutput('You have frozen to death.', 'msg-bad');
      gameDeath(null);
      return;
    }
    if (GS.f9 === 1) {
      printOutput('The station requires power with the seal blown.', 'msg-warn');
      printOutput('You have frozen to death.', 'msg-bad');
      gameDeath(null);
      return;
    }
  }

  GS.o[i] = GS.p;
  GS.c--;
  if (i === 3) GS.f0 = 0; // dropping oxygen module deactivates it
  printOutput('OK.', 'msg-good');
  updateUI();
}

/** INVENTORY */
function cmdInventory() {
  let found = false;
  for (let i = 1; i <= 14; i++) {
    if (carrying(i)) {
      if (!found) printOutput('You are carrying:', 'msg-normal');
      printOutput('  ' + ITEM_NAME[i], 'msg-item');
      found = true;
    }
  }
  if (!found) printOutput('You are carrying nothing.', 'msg-normal');
}

/**
 * LOOK / DESCRIBE / WAIT — re-display the current location.
 * In the BASIC these commands jump back to line 650, i.e. they cost a turn
 * exactly like a move. Keeping that behaviour also gives the player a way to
 * wait, which matters at location 14 where every exit is fatal until the
 * deactivator is exposed.
 */
function cmdLook() {
  beginTurn();
}

/** TRANSPORT (from transporter room, loc 36) */
function cmdTransport() {
  const unit = GS.o[8];

  if (GS.p === 36) {
    // In the transporter room: beam to wherever the unit was left
    if (unit === 99) {
      printOutput('You cannot beam to a unit you are carrying.', 'msg-warn');
      return;
    }
    if (!unit || unit > 42) {
      printOutput('The transporter has no destination locked in.', 'msg-warn');
      return;
    }
    printOutput('Beaming in progress...', 'msg-good');
    doMove(unit);
    return;
  }

  // Standing at the unit: beam back to the transporter room
  if (unit === GS.p) {
    printOutput('Beaming in progress...', 'msg-good');
    doMove(36);
    return;
  }

  printOutput('I cannot process your request!', 'msg-warn');
}

/** DIG (at Burg Crater, loc 10) */
function cmdDig() {
  if (GS.p !== 10) {
    printOutput("You can't dig here.", 'msg-warn');
    return;
  }
  if (GS.o[9] !== 0 && GS.o[9] !== GS.p) {
    printOutput('You have already dug here.', 'msg-warn');
    return;
  }
  GS.o[9] = 10; // dilithium crystals appear
  printOutput('You dig into the soft surface and find something!', 'msg-good');
  updateUI();
}

/** FUEL (at engine room, loc 19) */
function cmdFuel() {
  if (GS.p !== 19) {
    printOutput("You can't fuel the rocket from here.", 'msg-warn');
    return;
  }
  if (!carrying(9)) {
    printOutput('You have nothing to fuel it with!', 'msg-warn');
    return;
  }
  GS.o[9] = 98; // fuel-loaded sentinel (no longer in inventory)
  GS.c--;
  printOutput('Fuel is now loaded.', 'msg-good');
  updateUI();
}

/** READ COMPUTER (at station control center, loc 35) */
function cmdRead(input) {
  if (GS.p !== 35) {
    printOutput("There is nothing here to read.", 'msg-warn');
    return;
  }
  const i = parseItem(input);
  if (i !== 10 && i !== 0) {
    // Tried to read something other than the computer
    printOutput("There is nothing to do it to!", 'msg-warn');
    return;
  }
  // Item 0 means just "read" with no noun — allow it at the terminal
  if (i === 0 && GS.p !== 35) {
    printOutput("There is nothing here to read.", 'msg-warn');
    return;
  }

  // Computer terminal readout
  if (GS.v === 0) {
    printOutput('STATION COMPUTER LOG:', 'msg-system');
    printOutput('Bomb deactivator located somewhere east of', 'msg-normal');
    printOutput('the space station, on the moon\'s surface.', 'msg-normal');
  } else if (GS.v === 1) {
    printOutput('STATION COMPUTER LOG:', 'msg-system');
    printOutput('Local fuel source: dilithium crystals.', 'msg-normal');
  } else {
    printOutput('STATION COMPUTER LOG:', 'msg-system');
    printOutput('Dilithium found in soft surfaces.', 'msg-normal');
  }
  if (GS.f7 === 1) {
    printOutput('Spacecraft repairs completed.', 'msg-good');
  }
  GS.v++;
}

/** DEACTIVATE BOMB */
function cmdDeactivate() {
  if (!carrying(6)) {
    printOutput('You have nothing to do it with!', 'msg-warn');
    return;
  }
  // The bomb must be carried or present in the room
  if (GS.o[7] !== GS.p && !carrying(7)) {
    printOutput("You can't do it from here!", 'msg-warn');
    return;
  }
  if (GS.f7 === 1) {
    printOutput('The bomb is already deactivated.', 'msg-warn');
    return;
  }
  GS.f7 = 1;
  printOutput('Bomb is now deactivated.', 'msg-good');
  updateUI();
}

/** BLAST OFF (from spacecraft control room, loc 21) */
function cmdBlast() {
  if (GS.p !== 21) {
    printOutput("You can't blast off from here.", 'msg-warn');
    return;
  }
  if (GS.o[9] !== 98) {
    printOutput('Your spacecraft has no fuel!', 'msg-warn');
    return;
  }
  if (GS.f7 === 0) {
    printOutput('Repairs not yet complete.', 'msg-warn');
    return;
  }
  gameWin();
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT PARSER
// ─────────────────────────────────────────────────────────────────────────────

const DIR_MAP = {
  n: 0, north: 0,
  s: 1, south: 1,
  e: 2, east:  2,
  w: 3, west:  3,
  u: 4, up:    4,
  d: 5, down:  5,
};

function processInput(rawInput) {
  if (GS.gameOver) return;

  const input = rawInput.trim().toLowerCase();
  if (!input) return;

  // ── Save to history ────────────────────────────────────────────────────────
  if (GS.inputHistory[GS.inputHistory.length - 1] !== rawInput) {
    GS.inputHistory.push(rawInput);
  }
  GS.historyIndex = GS.inputHistory.length;

  // Echo the command
  printOutput('> ' + rawInput, 'msg-cmd');

  // ── Obstacle mode: the next input must be "use/try <item>" ────────────────
  // BASIC subroutine 4890: anything that is not TRY/USE <item you have>
  // counts as a failed attempt. For fatal barriers a failure kills; for the
  // locked shed the attempt simply fails and normal play resumes, so the
  // player is never trapped in obstacle mode.
  if (GS.obstacle) {
    const obs = GS.obstacle;
    GS.obstacle = null;

    const verb3 = input.slice(0, 3);
    let success = false;

    if (verb3 === 'use' || verb3 === 'try') {
      const i = parseItem(input);
      if (i < 1) {
        printOutput('Use what?', 'msg-warn');
      } else if (!carrying(i)) {
        printOutput("You don't have " + ITEM_NAME[i] + '!', 'msg-warn');
      } else if (i === obs.requiredItem) {
        success = true;
      }
    }

    if (success) {
      obs.onSuccess();
    } else {
      obs.onFail();
    }
    return;
  }

  // ── Normal command parsing ─────────────────────────────────────────────────
  const verb3 = input.slice(0, 3);
  const firstWord = input.split(' ')[0];

  // Quit
  if (verb3 === 'qui' || verb3 === 'end') {
    printOutput('Thanks for playing!', 'msg-system');
    GS.gameOver = true;
    updateUI();
    return;
  }

  // Direction
  if (firstWord in DIR_MAP) {
    cmdMove(DIR_MAP[firstWord]);
    return;
  }
  // Single-letter directions covered above via firstWord, but handle 'u'/'d'
  // which might look like short words
  if (DIR_MAP[verb3] !== undefined && input.length <= 5) {
    cmdMove(DIR_MAP[verb3]);
    return;
  }

  // Get
  if (verb3 === 'get' || verb3 === 'tak' || verb3 === 'kee') {
    cmdGet(input); return;
  }

  // Drop
  if (verb3 === 'dro' || verb3 === 'lea' || verb3 === 'put') {
    cmdDrop(input); return;
  }

  // Inventory
  if (verb3 === 'inv') { cmdInventory(); return; }

  // Look / describe / wait — all cost a turn, exactly as in the BASIC
  if (verb3 === 'loo' || verb3 === 'des' || verb3 === 'wai') { cmdLook(); return; }

  // Transport
  if (verb3 === 'tra' && input.length <= 9) { cmdTransport(); return; }

  // Dig
  if (verb3 === 'dig') { cmdDig(); return; }

  // Fuel
  if (verb3 === 'fue') { cmdFuel(); return; }

  // Read
  if (verb3 === 'rea') { cmdRead(input); return; }

  // Deactivate
  if (verb3 === 'dea') { cmdDeactivate(); return; }

  // Blast off
  if (verb3 === 'bla') { cmdBlast(); return; }

  // Use / Try (outside obstacle mode — attempt to use something contextually)
  if (verb3 === 'use' || verb3 === 'try') {
    printOutput("There is nothing here that requires that.", 'msg-warn');
    return;
  }

  printOutput('Invalid command. Try: N S E W U D, GET, DROP, INVENTORY, LOOK,', 'msg-warn');
  printOutput('WAIT, TRANSPORT, DIG, FUEL, READ, DEACTIVATE, BLAST, or USE <item>.', 'msg-warn');
}

// ─────────────────────────────────────────────────────────────────────────────
// INTRO / INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function showInstructions() {
  printOutput('SURVIVAL — Moon Survival', 'msg-good');
  printOutput('Original BASIC game by Stewart Rush, 1981', 'msg-system');
  printBlank();
  printOutput('You have crash landed on the moon.', 'msg-normal');
  printOutput('You have limited supplies and time in which to survive.', 'msg-normal');
  printBlank();
  printOutput('MOVEMENT: Type N, S, E, W, U, D  —or—  NORTH, SOUTH, etc.', 'msg-normal');
  printOutput('ACTIONS : GET <item>, DROP <item>, INVENTORY', 'msg-normal');
  printOutput('SPECIAL : DIG, FUEL, READ <computer>, DEACTIVATE, BLAST,', 'msg-normal');
  printOutput('          TRANSPORT, LOOK, WAIT  (LOOK and WAIT cost a turn)', 'msg-normal');
  printOutput('OBSTACLE: When prompted, type  USE <item>  or  TRY <item>', 'msg-normal');
  printBlank();
  printOutput('Commands may be abbreviated to their first 3 letters.', 'msg-normal');
  printOutput('Once you survive, aim for the shortest escape time!', 'msg-normal');
  printOutput("*** GOOD LUCK ***", 'msg-good');
  printHR();
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTART
// ─────────────────────────────────────────────────────────────────────────────

function restartGame() {
  elTranscript.innerHTML = '';
  initGame();
  showInstructions();
  beginTurn();
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD INPUT
// ─────────────────────────────────────────────────────────────────────────────

function handleKeyDown(e) {
  if (e.key === 'Enter') {
    const val = elInput.value;
    elInput.value = '';
    processInput(val);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (GS.historyIndex > 0) {
      GS.historyIndex--;
      elInput.value = GS.inputHistory[GS.historyIndex] || '';
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (GS.historyIndex < GS.inputHistory.length - 1) {
      GS.historyIndex++;
      elInput.value = GS.inputHistory[GS.historyIndex] || '';
    } else {
      GS.historyIndex = GS.inputHistory.length;
      elInput.value = '';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  elTranscript    = document.getElementById('transcript');
  elInput         = document.getElementById('command-input');
  elO2            = document.getElementById('hud-oxygen');
  elPower         = document.getElementById('hud-power');
  elTime          = document.getElementById('hud-moves');
  elLocation      = document.getElementById('hud-location');
  elInventoryList = document.getElementById('inventory-list');
  elRoomList      = document.getElementById('room-items-list');

  // Direction buttons
  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      if (dir in DIR_MAP) processInput(dir);
    });
  });

  // Quick-action buttons
  const btnTake = document.getElementById('btn-take');
  const btnUse  = document.getElementById('btn-use');
  const btnDrop = document.getElementById('btn-drop');
  const btnLook = document.getElementById('btn-look');
  const btnInv  = document.getElementById('btn-inv');

  if (btnTake) btnTake.addEventListener('click', () => {
    elInput.value = 'get ';
    elInput.focus();
  });
  if (btnUse) btnUse.addEventListener('click', () => {
    elInput.value = 'use ';
    elInput.focus();
  });
  if (btnDrop) btnDrop.addEventListener('click', () => {
    elInput.value = 'drop ';
    elInput.focus();
  });
  if (btnLook) btnLook.addEventListener('click', () => processInput('look'));
  if (btnInv)  btnInv.addEventListener('click',  () => processInput('inventory'));

  // Restart button
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) btnRestart.addEventListener('click', restartGame);

  // Command input
  elInput.addEventListener('keydown', handleKeyDown);

  // Start the game
  restartGame();
  elInput.focus();
});
