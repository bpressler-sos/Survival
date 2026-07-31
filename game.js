/**
 * game.js — SURVIVAL: Space Station Omega
 *
 * Game engine: state management, parser, command handlers, UI updates.
 * All static world data is in gameData.js (must be loaded first).
 *
 * Architecture overview
 * ─────────────────────
 *  GameState   — single mutable object holding all game state
 *  parseInput  — tokenises player input → calls executeCommand
 *  executeCommand — dispatches to a command handler
 *  cmd*        — one function per player command
 *  onTurnEnd   — called after every successful action; ticks resources,
 *                checks robot, checks win/lose
 *  update*     — DOM-manipulation helpers called by printOutput / onTurnEnd
 *
 * Approved gameplay fixes implemented here:
 *   1. Dark-room safety  — GameState.enteredFrom tracks the safe retreat dir.
 *   2. Robot fairness    — robotWarnings counter; two turns before death.
 *   3. All map exits     — reciprocal by construction in gameData.js.
 *   4. Resources raised  — in GAME_CONFIG (gameData.js).
 *   5. Inventory limit   — in GAME_CONFIG (gameData.js).
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

/** All mutable game state. Reset by initGame(). */
let GameState = {};

function initGame() {
  GameState = {
    // Player location
    currentRoom: 1,
    enteredFrom: null,        // direction player arrived from (for dark-room safety)

    // Resources
    oxygen: GAME_CONFIG.startingOxygen,
    power:  GAME_CONFIG.startingPower,

    // Inventory: array of item ids
    inventory: [],

    // Turn counter
    moves: 0,

    // ── Robot state ──────────────────────────────────────────────────────────
    // robotWarnings: how many more turns before robot kills (null = not triggered)
    robotWarnings: null,

    // ── Flags ────────────────────────────────────────────────────────────────
    flags: {
      suitOn:           false,   // player has put on the spacesuit
      powerRestored:    false,   // power cell installed in power room
      bombDeactivated:  false,   // bomb has been deactivated
      gameOver:         false,   // true once any end state fires
      won:              false,
    },

    // Command input history (up-arrow recall)
    inputHistory: [],
    historyIndex: -1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM REFERENCES  (set in window.onload)
// ─────────────────────────────────────────────────────────────────────────────

let elTranscript, elInput, elOxygen, elPower, elMoves, elLocation,
    elInventoryList, elDirButtons, elRoomItems, elTakeBtn, elUseBtn, elDropBtn;

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append a line (or block) of text to the transcript.
 * @param {string} text
 * @param {string} [cssClass]  — 'msg-normal' | 'msg-warn' | 'msg-good' | 'msg-bad' | 'msg-system'
 */
function printOutput(text, cssClass) {
  const cls = cssClass || 'msg-normal';
  const div = document.createElement('div');
  div.className = 'output-line ' + cls;
  // Preserve blank lines: split on \n and insert <br> for empty lines
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) div.appendChild(document.createElement('br'));
    div.appendChild(document.createTextNode(line));
  });
  elTranscript.appendChild(div);
  elTranscript.scrollTop = elTranscript.scrollHeight;
}

/** Print a blank separator line */
function printBlank() {
  const div = document.createElement('div');
  div.className = 'output-line output-blank';
  div.innerHTML = '&nbsp;';
  elTranscript.appendChild(div);
  elTranscript.scrollTop = elTranscript.scrollHeight;
}

/** Print room name as a header */
function printRoomHeader(name) {
  printOutput('[ ' + name.toUpperCase() + ' ]', 'msg-room');
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD UPDATES
// ─────────────────────────────────────────────────────────────────────────────

function updateHUD() {
  const room = ROOMS[GameState.currentRoom];
  elLocation.textContent = room ? room.name.toUpperCase() : '---';
  elMoves.textContent    = GameState.moves;

  // Oxygen display — colour-code by urgency
  elOxygen.textContent = 'O\u2082: ' + GameState.oxygen;
  elOxygen.className = 'hud-stat';
  if (GameState.oxygen <= 20)       elOxygen.classList.add('hud-critical');
  else if (GameState.oxygen <= 50)  elOxygen.classList.add('hud-warning');

  // Power display
  elPower.textContent = 'PWR: ' + GameState.power;
  elPower.className = 'hud-stat';
  if (GameState.power <= 20)        elPower.classList.add('hud-critical');
  else if (GameState.power <= 50)   elPower.classList.add('hud-warning');
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION BUTTON UPDATES
// ─────────────────────────────────────────────────────────────────────────────

function updateDirectionButtons() {
  const room = ROOMS[GameState.currentRoom];
  if (!room) return;

  // Effective exits: room exits + the outer-airlock north (special)
  const availableExits = Object.assign({}, room.exits);

  // The outer airlock has a north exit that is special (death or conditional)
  if (room.special === 'outerAirlock') availableExits.n = true;

  // In a dark room without a flashlight, only the safe-retreat direction
  // is navigable (approved dark-room safety fix #1).
  const darkRestrict = isRoomDark();
  const safeRetreatDir = (darkRestrict && GameState.enteredFrom)
    ? DIR_OPPOSITE[GameState.enteredFrom]
    : null;

  ['n', 's', 'e', 'w', 'u', 'd'].forEach(dir => {
    const btn = document.getElementById('btn-' + dir);
    if (!btn) return;
    const exitExists = availableExits[dir] !== undefined && availableExits[dir] !== null;
    const blockedByDark = darkRestrict && exitExists && dir !== safeRetreatDir;

    if (exitExists && !blockedByDark) {
      btn.disabled = false;
      btn.classList.remove('dir-unavailable');
    } else {
      btn.disabled = true;
      btn.classList.add('dir-unavailable');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY PANEL UPDATES
// ─────────────────────────────────────────────────────────────────────────────

function updateInventoryPanel() {
  elInventoryList.innerHTML = '';

  if (GameState.inventory.length === 0) {
    const li = document.createElement('li');
    li.textContent = '(empty)';
    li.className = 'inv-empty';
    elInventoryList.appendChild(li);
  } else {
    GameState.inventory.forEach(itemId => {
      const item = ITEMS[itemId];
      if (!item) return;
      const li = document.createElement('li');
      li.textContent = item.name;
      li.dataset.itemId = itemId;
      li.className = 'inv-item';
      elInventoryList.appendChild(li);
    });
  }

  // Weight display
  const used  = inventoryWeight();
  const limit = GAME_CONFIG.inventoryLimit;
  const cap = document.getElementById('inv-capacity');
  if (cap) cap.textContent = used + ' / ' + limit + ' slots';
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM ITEMS PANEL
// ─────────────────────────────────────────────────────────────────────────────

function updateRoomItems() {
  if (!elRoomItems) return;
  const room = ROOMS[GameState.currentRoom];
  elRoomItems.innerHTML = '';

  const isDark = isRoomDark();

  if (!isDark && room && room.items.length > 0) {
    room.items.forEach(itemId => {
      const item = ITEMS[itemId];
      if (!item) return;
      const li = document.createElement('li');
      li.textContent = item.name;
      li.dataset.itemId = itemId;
      li.className = 'room-item';
      elRoomItems.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = isDark ? '(too dark to see)' : '(nothing)';
    li.className = 'inv-empty';
    elRoomItems.appendChild(li);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK-ACTION BUTTONS (Take / Use / Drop)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wire up the Take, Use, and Drop quick-action buttons.
 * They show a small popover so the player can choose which item to act on,
 * then internally execute the same parser command.
 */
function initQuickActions() {
  const takeBtn = document.getElementById('btn-take');
  const useBtn  = document.getElementById('btn-use');
  const dropBtn = document.getElementById('btn-drop');

  if (takeBtn) {
    takeBtn.addEventListener('click', () => {
      const room = ROOMS[GameState.currentRoom];
      if (!room || room.items.length === 0 || isRoomDark()) {
        printOutput('There is nothing here to take.', 'msg-warn');
        return;
      }
      showItemPicker('Take which item?', room.items, itemId => {
        submitCommand('GET ' + ITEMS[itemId].keywords[0]);
      });
    });
  }

  if (useBtn) {
    useBtn.addEventListener('click', () => {
      if (GameState.inventory.length === 0) {
        printOutput('You are not carrying anything.', 'msg-warn');
        return;
      }
      showItemPicker('Use which item?', GameState.inventory, itemId => {
        submitCommand('USE ' + ITEMS[itemId].keywords[0]);
      });
    });
  }

  if (dropBtn) {
    dropBtn.addEventListener('click', () => {
      if (GameState.inventory.length === 0) {
        printOutput('You are not carrying anything.', 'msg-warn');
        return;
      }
      showItemPicker('Drop which item?', GameState.inventory, itemId => {
        submitCommand('DROP ' + ITEMS[itemId].keywords[0]);
      });
    });
  }
}

/**
 * Display a small inline picker below the transcript.
 * @param {string}   prompt     — label shown above the picker
 * @param {string[]} itemIds    — list of item ids to offer
 * @param {Function} callback   — called with chosen itemId
 */
function showItemPicker(prompt, itemIds, callback) {
  // Remove any existing picker
  const existing = document.getElementById('item-picker');
  if (existing) existing.remove();

  const picker = document.createElement('div');
  picker.id = 'item-picker';
  picker.className = 'item-picker';

  const label = document.createElement('div');
  label.className = 'picker-label';
  label.textContent = prompt;
  picker.appendChild(label);

  itemIds.forEach(itemId => {
    const item = ITEMS[itemId];
    if (!item) return;
    const btn = document.createElement('button');
    btn.className = 'picker-item-btn';
    btn.textContent = item.name;
    btn.addEventListener('click', () => {
      picker.remove();
      callback(itemId);
    });
    picker.appendChild(btn);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'picker-cancel-btn';
  cancelBtn.textContent = '[Cancel]';
  cancelBtn.addEventListener('click', () => picker.remove());
  picker.appendChild(cancelBtn);

  // Insert just before the input area
  const inputArea = document.getElementById('input-area');
  inputArea.parentNode.insertBefore(picker, inputArea);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Is the current room dark and the player has no light? */
function isRoomDark() {
  const room = ROOMS[GameState.currentRoom];
  if (!room || !room.dark) return false;
  return !GameState.inventory.includes('flashlight');
}

/** Total inventory weight (slots used) */
function inventoryWeight() {
  return GameState.inventory.reduce((sum, id) => {
    const item = ITEMS[id];
    return sum + (item ? item.weight : 0);
  }, 0);
}

/**
 * Find an item id matching a keyword fragment.
 * Searches a provided list (inventory or room items).
 * Returns the id string or null.
 */
function findItemByKeyword(keyword, idList) {
  if (!keyword) return null;
  const kw = keyword.toLowerCase();
  // Exact keyword match first
  for (const id of idList) {
    const item = ITEMS[id];
    if (!item) continue;
    if (item.keywords.includes(kw)) return id;
  }
  // Partial match on keyword list
  for (const id of idList) {
    const item = ITEMS[id];
    if (!item) continue;
    if (item.keywords.some(k => k.startsWith(kw))) return id;
  }
  // Partial match on item name
  for (const id of idList) {
    const item = ITEMS[id];
    if (!item) continue;
    if (item.name.toLowerCase().includes(kw)) return id;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM DESCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print the full description for the current room.
 * Handles dark rooms and item listing.
 * @param {boolean} brief — if true, suppress the long description (re-entry)
 */
function describeRoom(brief) {
  const room = ROOMS[GameState.currentRoom];
  if (!room) return;

  printBlank();
  printRoomHeader(room.name);

  if (isRoomDark()) {
    printOutput(MESSAGES.darkNoLight, 'msg-warn');
  } else {
    if (!brief) {
      printOutput(room.description, 'msg-normal');
    }

    // List items on the floor
    if (room.items.length > 0) {
      const names = room.items.map(id => ITEMS[id] ? ITEMS[id].name : id);
      if (names.length === 1) {
        printOutput('You see: ' + names[0] + '.', 'msg-item');
      } else {
        printOutput('You see: ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + '.', 'msg-item');
      }
    }

    // List available exits
    const exitList = Object.keys(room.exits)
      .filter(dir => room.exits[dir] !== null)
      .map(dir => DIR_DISPLAY[dir] || dir.toUpperCase());

    // The outer airlock has a north exit that is special
    if (room.special === 'outerAirlock' && !exitList.includes('North')) {
      exitList.push('North (outer hatch — DANGER)');
    }

    if (exitList.length > 0) {
      printOutput('Exits: ' + exitList.join(', ') + '.', 'msg-exit');
    } else {
      printOutput('There are no obvious exits!', 'msg-warn');
    }
  }

  updateHUD();
  updateDirectionButtons();
  updateInventoryPanel();
  updateRoomItems();
}

// ─────────────────────────────────────────────────────────────────────────────
// MOVEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to move the player in `dir` (single letter: n/s/e/w/u/d).
 * Applies dark-room safety: the direction the player entered from is always
 * safe to retrace.
 */
function cmdGo(dir) {
  if (!dir) {
    printOutput('Go where? Please specify a direction (N, S, E, W).', 'msg-warn');
    return false;
  }

  const room = ROOMS[GameState.currentRoom];
  if (!room) return false;

  // ── Special case: outer airlock north hatch ──────────────────────────────
  if (room.special === 'outerAirlock' && dir === 'n') {
    if (!GameState.flags.suitOn) {
      printOutput(MESSAGES.airlockNoSuit, 'msg-warn');
      return false;
    } else {
      // Safe to open hatch while suited — they look out and return
      printOutput(MESSAGES.airlockSuitOk, 'msg-normal');
      return true;    // counts as a turn but no room change
    }
  }

  // ── Dark-room safety (approved fix #1) ───────────────────────────────────
  // If room is dark and player has no light, only the entrance direction is safe.
  // Any other direction gets a warning and is blocked.
  if (isRoomDark()) {
    const safeDir = GameState.enteredFrom
      ? DIR_OPPOSITE[GameState.enteredFrom]
      : null;

    if (dir !== safeDir) {
      printOutput(
        'It is too dark to move safely in that direction. ' +
        (safeDir ? 'You could safely go back ' + DIR_DISPLAY[safeDir] + '.' : ''),
        'msg-warn'
      );
      return false;
    }
  }

  // ── Normal movement ───────────────────────────────────────────────────────
  const destId = room.exits[dir];
  if (!destId) {
    printOutput('You cannot go ' + (DIR_DISPLAY[dir] || dir) + ' from here.', 'msg-warn');
    return false;
  }

  // Move the player
  GameState.enteredFrom = dir;
  GameState.currentRoom = destId;

  describeRoom(false);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET / TAKE
// ─────────────────────────────────────────────────────────────────────────────

function cmdGet(noun) {
  if (!noun) {
    printOutput('Get what?', 'msg-warn');
    return false;
  }

  if (isRoomDark()) {
    printOutput('It is too dark to find anything.', 'msg-warn');
    return false;
  }

  const room = ROOMS[GameState.currentRoom];
  const itemId = findItemByKeyword(noun, room.items);

  if (!itemId) {
    printOutput('You don\'t see any "' + noun + '" here.', 'msg-warn');
    return false;
  }

  const item = ITEMS[itemId];

  if (!item.portable) {
    printOutput('You cannot take the ' + item.name + '.', 'msg-warn');
    return false;
  }

  // Check inventory capacity
  if (inventoryWeight() + item.weight > GAME_CONFIG.inventoryLimit) {
    printOutput(
      'You are carrying too much to pick up the ' + item.name + '. ' +
      'Drop something first.',
      'msg-warn'
    );
    return false;
  }

  // Transfer item from room to inventory
  room.items.splice(room.items.indexOf(itemId), 1);
  GameState.inventory.push(itemId);

  printOutput('Taken: ' + item.name + '.', 'msg-good');

  updateInventoryPanel();
  updateRoomItems();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// DROP
// ─────────────────────────────────────────────────────────────────────────────

function cmdDrop(noun) {
  if (!noun) {
    printOutput('Drop what?', 'msg-warn');
    return false;
  }

  const itemId = findItemByKeyword(noun, GameState.inventory);

  if (!itemId) {
    printOutput('You are not carrying any "' + noun + '".', 'msg-warn');
    return false;
  }

  const item = ITEMS[itemId];

  // If dropping the spacesuit, unmark suit flag
  if (itemId === 'spacesuit') {
    GameState.flags.suitOn = false;
  }

  GameState.inventory.splice(GameState.inventory.indexOf(itemId), 1);
  ROOMS[GameState.currentRoom].items.push(itemId);

  printOutput('Dropped: ' + item.name + '.', 'msg-normal');

  updateInventoryPanel();
  updateRoomItems();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// USE
// ─────────────────────────────────────────────────────────────────────────────

function cmdUse(noun) {
  if (!noun) {
    printOutput('Use what?', 'msg-warn');
    return false;
  }

  // Search both inventory and room for the item
  const invId  = findItemByKeyword(noun, GameState.inventory);
  const roomId = isRoomDark() ? null :
    findItemByKeyword(noun, ROOMS[GameState.currentRoom].items);

  const itemId = invId || roomId;

  if (!itemId) {
    printOutput('You don\'t see any "' + noun + '" here or in your inventory.', 'msg-warn');
    return false;
  }

  const item = ITEMS[itemId];
  const inInventory = GameState.inventory.includes(itemId);
  const room = ROOMS[GameState.currentRoom];

  // ── Flashlight ────────────────────────────────────────────────────────────
  if (item.useEffect === 'light') {
    printOutput(item.useMessage, 'msg-good');
    if (!inInventory) {
      // Auto-pickup if on floor
      room.items.splice(room.items.indexOf(itemId), 1);
      GameState.inventory.push(itemId);
      printOutput('(You pick up the flashlight.)', 'msg-normal');
    }
    describeRoom(false);
    return true;
  }

  // ── Oxygen tank ───────────────────────────────────────────────────────────
  if (item.useEffect === 'oxygen') {
    if (!inInventory) {
      printOutput('You need to pick up the ' + item.name + ' first.', 'msg-warn');
      return false;
    }
    const boost = GAME_CONFIG.oxygenTankBoost;
    GameState.oxygen += boost;
    // Remove used tank from inventory
    GameState.inventory.splice(GameState.inventory.indexOf(itemId), 1);
    printOutput(item.useMessage, 'msg-good');
    updateInventoryPanel();
    updateHUD();
    return true;
  }

  // ── Power cell ────────────────────────────────────────────────────────────
  if (item.useEffect === 'power') {
    if (!inInventory) {
      printOutput('You need to be carrying the ' + item.name + '.', 'msg-warn');
      return false;
    }
    if (room.special !== 'powerRoom') {
      printOutput(item.useFailMsg, 'msg-warn');
      return false;
    }
    if (GameState.flags.powerRestored) {
      printOutput(MESSAGES.powerAlreadyRestored, 'msg-warn');
      return false;
    }
    GameState.flags.powerRestored = true;
    GameState.power += GAME_CONFIG.powerCellBoost;
    GameState.inventory.splice(GameState.inventory.indexOf(itemId), 1);
    printOutput(MESSAGES.powerRestored, 'msg-good');
    updateInventoryPanel();
    updateHUD();
    return true;
  }

  // ── Spacesuit ─────────────────────────────────────────────────────────────
  if (item.useEffect === 'suit') {
    if (!inInventory) {
      printOutput('You need to pick up the spacesuit first.', 'msg-warn');
      return false;
    }
    if (GameState.flags.suitOn) {
      printOutput('You are already wearing the spacesuit.', 'msg-warn');
      return false;
    }
    GameState.flags.suitOn = true;
    printOutput(item.useMessage, 'msg-good');
    return true;
  }

  // ── Access card (in escape pod bay) ──────────────────────────────────────
  if (item.useEffect === 'access') {
    if (!inInventory) {
      printOutput('You need to be carrying the ' + item.name + '.', 'msg-warn');
      return false;
    }
    if (room.special !== 'escapePod') {
      printOutput(
        'The access card is coded for the escape pod launch system.',
        'msg-warn'
      );
      return false;
    }
    return cmdActivateEscapePod();
  }

  // ── Keycard (in transporter room) ─────────────────────────────────────────
  if (item.useEffect === 'transport') {
    if (!inInventory) {
      printOutput('You need to be carrying the ' + item.name + '.', 'msg-warn');
      return false;
    }
    if (room.special !== 'transporter') {
      printOutput(item.useFailMsg, 'msg-warn');
      return false;
    }
    return cmdActivateTransporter();
  }

  // ── Deactivator ───────────────────────────────────────────────────────────
  if (item.useEffect === 'deactivate') {
    if (!inInventory) {
      printOutput('You need to pick up the deactivator first.', 'msg-warn');
      return false;
    }
    return cmdDeactivateBomb();
  }

  // ── Repair (toolkit — generic) ────────────────────────────────────────────
  if (item.useEffect === 'repair') {
    printOutput(item.useMessage, 'msg-normal');
    return true;
  }

  // ── Generic use ───────────────────────────────────────────────────────────
  if (item.useMessage) {
    printOutput(item.useMessage, 'msg-normal');
    return true;
  }

  printOutput('Nothing useful happens.', 'msg-warn');
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIAL INTERACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Attempt to activate the escape pod. */
function cmdActivateEscapePod() {
  // Check bomb
  const bombDeactivated = GameState.flags.bombDeactivated;
  const bombInRoom      = ROOMS[24].items.includes('bomb');
  const bombInInv       = GameState.inventory.includes('bomb');
  const bombActive      = !bombDeactivated && (bombInRoom || bombInInv ||
    Object.values(ROOMS).some(r => r.items.includes('bomb')));

  if (bombActive) {
    printOutput(MESSAGES.escapePodBombActive, 'msg-warn');
    return false;
  }

  if (!GameState.inventory.includes('accesscard')) {
    printOutput(MESSAGES.escapePodNoCard, 'msg-warn');
    return false;
  }

  // WIN!
  printBlank();
  printOutput(MESSAGES.escapePodLaunching, 'msg-good');
  printBlank();
  setTimeout(() => {
    printOutput(MESSAGES.win, 'msg-win');
    GameState.flags.won = true;
    GameState.flags.gameOver = true;
    updateHUD();
    disableInput();
  }, 800);

  return true;
}

/** Attempt to activate the transporter. */
function cmdActivateTransporter() {
  if (!GameState.flags.powerRestored) {
    printOutput(MESSAGES.transporterNoPower, 'msg-warn');
    return false;
  }
  if (!GameState.inventory.includes('keycard')) {
    printOutput(MESSAGES.transporterNoKey, 'msg-warn');
    return false;
  }

  printOutput(MESSAGES.transporterActivating, 'msg-good');

  // Teleport to Robot Base Entry (room 19) — a useful shortcut into the base
  // that still requires navigating the base interior to reach the control room.
  // TODO: original BASIC destination unclear; 19 chosen as most logical.
  setTimeout(() => {
    GameState.currentRoom = 19;
    GameState.enteredFrom = null;  // teleport clears safe-retreat direction
    printOutput(MESSAGES.transporterArrival, 'msg-good');
    describeRoom(false);
  }, 600);

  return true;
}

/** Attempt to deactivate the bomb. */
function cmdDeactivateBomb() {
  if (GameState.flags.bombDeactivated) {
    printOutput(MESSAGES.bombAlreadyDeactivated, 'msg-warn');
    return false;
  }

  // Bomb must be in inventory OR in current room
  const bombInInv  = GameState.inventory.includes('bomb');
  const bombInRoom = ROOMS[GameState.currentRoom].items.includes('bomb');

  if (!bombInInv && !bombInRoom) {
    printOutput(MESSAGES.bombNoBomb, 'msg-warn');
    return false;
  }

  GameState.flags.bombDeactivated = true;

  // Remove bomb from wherever it is
  if (bombInInv) {
    GameState.inventory.splice(GameState.inventory.indexOf('bomb'), 1);
  }
  if (bombInRoom) {
    const ri = ROOMS[GameState.currentRoom].items.indexOf('bomb');
    ROOMS[GameState.currentRoom].items.splice(ri, 1);
  }
  // Also remove from room 22 if it is still there
  const r22 = ROOMS[22].items.indexOf('bomb');
  if (r22 !== -1) ROOMS[22].items.splice(r22, 1);

  printOutput(MESSAGES.bombDeactivated, 'msg-good');
  updateInventoryPanel();
  updateRoomItems();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOK / EXAMINE
// ─────────────────────────────────────────────────────────────────────────────

function cmdLook() {
  describeRoom(false);
  return false;   // LOOK does not consume a turn
}

function cmdExamine(noun) {
  if (!noun) {
    printOutput('Examine what?', 'msg-warn');
    return false;
  }

  // Search inventory first, then room (if lit)
  const invId  = findItemByKeyword(noun, GameState.inventory);
  const roomId = isRoomDark() ? null :
    findItemByKeyword(noun, ROOMS[GameState.currentRoom].items);
  const itemId = invId || roomId;

  if (itemId) {
    printOutput(ITEMS[itemId].description, 'msg-normal');
    return false;  // examining does not consume a turn
  }

  // Allow examining the room itself
  if (['room', 'area', 'surroundings', 'around'].includes(noun.toLowerCase())) {
    cmdLook();
    return false;
  }

  printOutput('You see nothing special about that.', 'msg-warn');
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────────────────────

function cmdInventory() {
  if (GameState.inventory.length === 0) {
    printOutput('You are not carrying anything.', 'msg-normal');
  } else {
    const lines = ['You are carrying:'];
    GameState.inventory.forEach(id => {
      const item = ITEMS[id];
      if (item) lines.push('  ' + item.name);
    });
    const used = inventoryWeight();
    lines.push('(' + used + ' of ' + GAME_CONFIG.inventoryLimit + ' slots used)');
    printOutput(lines.join('\n'), 'msg-normal');
  }
  return false;  // no turn consumed
}

// ─────────────────────────────────────────────────────────────────────────────
// HELP / QUIT / RESTART
// ─────────────────────────────────────────────────────────────────────────────

function cmdHelp() {
  printOutput(MESSAGES.help, 'msg-system');
  return false;
}

function cmdQuit() {
  printBlank();
  printOutput('Thanks for playing SURVIVAL. Goodbye.', 'msg-system');
  GameState.flags.gameOver = true;
  disableInput();
  return false;
}

function cmdRestart() {
  // Re-initialise all game data: reset room items from a clean copy
  Object.keys(ROOMS).forEach(id => {
    ROOMS[id].items = ROOM_ITEM_RESET[id] ? ROOM_ITEM_RESET[id].slice() : [];
  });
  initGame();
  elTranscript.innerHTML = '';
  printOutput(MESSAGES.welcome, 'msg-system');
  describeRoom(false);
  enableInput();
  elInput.focus();
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROBOT MECHANIC  (approved fairness fix #2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called at the end of each valid turn while the player is in a robot-patrol room.
 * Two warning turns are given before the robot kills.
 * Carrying the badge suppresses all robot activity.
 */
function processRobot() {
  const room = ROOMS[GameState.currentRoom];
  if (!room || !room.robotPatrol) {
    // Player left the robot zone — reset warning counter
    GameState.robotWarnings = null;
    return;
  }

  // Badge protects the player
  if (GameState.inventory.includes('badge')) {
    GameState.robotWarnings = null;
    return;
  }

  // No badge — trigger or advance warning
  if (GameState.robotWarnings === null) {
    GameState.robotWarnings = GAME_CONFIG.robotWarningTurns;
    printOutput(MESSAGES.robotWarning1, 'msg-danger');
    printOutput('(You have ' + GameState.robotWarnings + ' turn(s) to leave this area!)', 'msg-warn');
    return;
  }

  GameState.robotWarnings--;

  if (GameState.robotWarnings === 1) {
    printOutput(MESSAGES.robotWarning2, 'msg-danger');
    printOutput('(LAST WARNING — leave NOW!)', 'msg-warn');
    return;
  }

  if (GameState.robotWarnings <= 0) {
    // Death
    GameState.flags.gameOver = true;
    printBlank();
    printOutput(MESSAGES.dieRobot, 'msg-bad');
    disableInput();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE TICK
// ─────────────────────────────────────────────────────────────────────────────

/** Decrement resources and check for death conditions. Returns false if game over. */
function tickResources() {
  GameState.oxygen = Math.max(0, GameState.oxygen - 1);
  GameState.power  = Math.max(0, GameState.power  - 1);

  if (GameState.oxygen <= 0) {
    GameState.flags.gameOver = true;
    printBlank();
    printOutput(MESSAGES.dieOxygen, 'msg-bad');
    disableInput();
    return false;
  }

  if (GameState.power <= 0 && !GameState.flags.powerRestored) {
    GameState.flags.gameOver = true;
    printBlank();
    printOutput(MESSAGES.diePower, 'msg-bad');
    disableInput();
    return false;
  }

  // Low oxygen warnings
  if (GameState.oxygen === 30) {
    printOutput('WARNING: Oxygen reserves critically low!', 'msg-danger');
  } else if (GameState.oxygen === 10) {
    printOutput('CRITICAL: Oxygen almost gone — you are about to die!', 'msg-danger');
  }

  updateHUD();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// TURN PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called after any action that consumes a turn.
 * Ticks resources, processes robot, checks win state.
 */
function onTurnEnd() {
  GameState.moves++;

  if (!tickResources()) return;   // game over from resource death

  processRobot();

  if (GameState.flags.gameOver) return;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tokenise and dispatch a player command.
 * Supports:  VERB  /  VERB NOUN  /  abbreviations
 * @param {string} rawInput — exactly what the player typed
 */
function parseInput(rawInput) {
  const input = rawInput.trim();
  if (!input) return;

  // Echo input to transcript
  printOutput('> ' + input, 'msg-echo');

  // History
  if (GameState.inputHistory[0] !== input) {
    GameState.inputHistory.unshift(input);
    if (GameState.inputHistory.length > 50) GameState.inputHistory.pop();
  }
  GameState.historyIndex = -1;

  if (GameState.flags.gameOver) {
    printOutput('The game is over. Type RESTART to play again.', 'msg-system');
    return;
  }

  const tokens = input.toLowerCase().split(/\s+/);
  const verb   = tokens[0];
  // Noun: everything after the first word, joined back (handles "TAKE OXYGEN TANK")
  const noun   = tokens.slice(1).join(' ');

  let turnConsumed = false;

  switch (verb) {
    // ── Movement ─────────────────────────────────────────────────────────────
    case 'n': case 'north': case 'go':
      if (verb === 'go') {
        // GO NORTH etc.
        const dirAlias = DIR_ALIASES[noun];
        if (dirAlias) {
          turnConsumed = cmdGo(dirAlias);
        } else {
          printOutput('Go where? (N, S, E, W)', 'msg-warn');
        }
      } else {
        turnConsumed = cmdGo(DIR_ALIASES[verb]);
      }
      break;
    case 's': case 'south': turnConsumed = cmdGo('s'); break;
    case 'e': case 'east':  turnConsumed = cmdGo('e'); break;
    case 'w': case 'west':  turnConsumed = cmdGo('w'); break;
    case 'u': case 'up':    turnConsumed = cmdGo('u'); break;
    case 'd': case 'down':  turnConsumed = cmdGo('d'); break;

    // ── Items ─────────────────────────────────────────────────────────────────
    case 'get': case 'take': case 'pick':
      turnConsumed = cmdGet(noun || tokens[1]);
      break;
    case 'drop': case 'put':
      turnConsumed = cmdDrop(noun);
      break;
    case 'use': case 'activate': case 'operate': case 'insert': case 'install':
      turnConsumed = cmdUse(noun);
      break;

    // ── Information ───────────────────────────────────────────────────────────
    case 'look': case 'l':
      cmdLook();
      break;
    case 'examine': case 'ex': case 'x': case 'inspect': case 'read':
      cmdExamine(noun);
      break;
    case 'inventory': case 'inv': case 'i':
      cmdInventory();
      break;
    case 'help': case '?':
      cmdHelp();
      break;

    // ── Meta ──────────────────────────────────────────────────────────────────
    case 'quit': case 'exit': case 'q':
      cmdQuit();
      break;
    case 'restart': case 'new':
      cmdRestart();
      break;

    // ── Convenient shortcuts ──────────────────────────────────────────────────
    case 'score':
      printOutput('Moves: ' + GameState.moves +
        '  Oxygen: ' + GameState.oxygen +
        '  Power: '  + GameState.power, 'msg-system');
      break;

    default:
      // Try to interpret single token as a direction
      if (DIR_ALIASES[verb]) {
        turnConsumed = cmdGo(DIR_ALIASES[verb]);
      } else {
        printOutput(
          'I don\'t understand "' + input + '". Type HELP for a list of commands.',
          'msg-warn'
        );
      }
  }

  if (turnConsumed) {
    onTurnEnd();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT HANDLING
// ─────────────────────────────────────────────────────────────────────────────

function submitCommand(text) {
  if (!text) return;
  elInput.value = '';
  parseInput(text);
  elInput.focus();
}

function disableInput() {
  elInput.disabled = true;
  // Disable all direction buttons
  document.querySelectorAll('.dir-btn').forEach(b => b.disabled = true);
}

function enableInput() {
  elInput.disabled = false;
  elInput.focus();
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM ITEM RESET TABLE
// ─────────────────────────────────────────────────────────────────────────────
// Built once at startup so restart() can restore items to their original rooms.

let ROOM_ITEM_RESET = {};

function buildResetTable() {
  Object.keys(ROOMS).forEach(id => {
    ROOM_ITEM_RESET[id] = ROOMS[id].items.slice();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  // Cache DOM references
  elTranscript    = document.getElementById('transcript');
  elInput         = document.getElementById('command-input');
  elOxygen        = document.getElementById('hud-oxygen');
  elPower         = document.getElementById('hud-power');
  elMoves         = document.getElementById('hud-moves');
  elLocation      = document.getElementById('hud-location');
  elInventoryList = document.getElementById('inventory-list');
  elDirButtons    = document.querySelectorAll('.dir-btn');
  elRoomItems     = document.getElementById('room-items-list');
  elTakeBtn       = document.getElementById('btn-take');
  elUseBtn        = document.getElementById('btn-use');
  elDropBtn       = document.getElementById('btn-drop');

  // Build the reset table before any game state is initialised
  buildResetTable();

  // Initialise game state
  initGame();

  // Wire up the text input
  elInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      submitCommand(elInput.value);
      return;
    }
    // Command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (GameState.historyIndex < GameState.inputHistory.length - 1) {
        GameState.historyIndex++;
        elInput.value = GameState.inputHistory[GameState.historyIndex];
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (GameState.historyIndex > 0) {
        GameState.historyIndex--;
        elInput.value = GameState.inputHistory[GameState.historyIndex];
      } else {
        GameState.historyIndex = -1;
        elInput.value = '';
      }
    }
  });

  // Wire up direction buttons
  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (GameState.flags.gameOver) return;
      const dir = btn.dataset.dir;
      if (dir) submitCommand(dir.toUpperCase());
    });
  });

  // Wire up restart button in HUD
  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      if (confirm('Restart the game? All progress will be lost.')) {
        cmdRestart();
      }
    });
  }

  // Wire up quick-action buttons
  initQuickActions();

  // Start the game
  printOutput(MESSAGES.welcome, 'msg-system');
  describeRoom(false);
  elInput.focus();
});
