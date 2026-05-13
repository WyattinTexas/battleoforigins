// ═══════════════════════════════════════════════════════════════
// DUNGEON CONFIGS — every dungeon's tunable values live here.
// To add a new dungeon: add a new entry to DUNGEONS keyed by id.
// To rebalance: change the numbers below — no scene code touches needed.
// See: dungeon-system-spec (memory) for the contract every dungeon follows.
// ═══════════════════════════════════════════════════════════════

// Tile types used inside a dungeon map (separate namespace from overworld tiles).
const D_TILE = {
  FLOOR: 0,
  WALL: 1,
  DOOR_CLOSED: 2,
  DOOR_OPEN: 3,
  STAIRS: 4,    // only walkable after boss defeated
  ENTRY: 5,     // floor + spawn marker
};

const D_IMPASSABLE = new Set([D_TILE.WALL, D_TILE.DOOR_CLOSED]);

const DUNGEONS = {
  // ─────────────────────────────────────────────────────────────
  // FROST DUNGEON — first dungeon, entrance at overworld (38, 3).
  // ─────────────────────────────────────────────────────────────
  frost_dungeon: {
    id: 'frost_dungeon',
    name: 'Frost Dungeon',

    // ── Tunable gameplay values ──────────────────────────────
    goldLossOnFail: 15,
    healBetweenFights: true,   // restore team HP after each non-final battle (testing flag)
    aggroOnContact: true,      // walk into a mob = battle starts
    bossHpMultiplier: 3,       // boss HP = card.maxHp * 3 (matches world boss scaling)
    mobHpMultiplier: 1,        // common mob HP scaling (1 = card default)
    bossRewardGold: 100,       // gold awarded on final boss defeat
    // Test flag — when true, walking into a mob instantly defeats it
    // (no battle). Useful for verifying victory-exit flow end-to-end.
    instaWin: false,

    // Overworld tile the player is dropped onto when leaving the dungeon
    // (success or failure). MUST be walkable. The world-gen explicitly
    // sets (38, 5) to a path tile south of the dungeon entrance.
    overworldExit: { x: 38, y: 5 },

    // ── Map (each row is a string of single-char tiles) ──────
    // Chars: '#'=wall, '.'=floor, '|'=closed door, 'E'=entry spawn, 'S'=staircase spawn slot
    // The grid is parsed by DungeonScene into the D_TILE numeric grid.
    // Width/height auto-derived from this array.
    mapAscii: [
      '##############',  //  0
      '#............#',  //  1   boss room
      '#............#',  //  2
      '#............#',  //  3
      '#......S.....#',  //  4   <- staircase slot (hidden until boss dies)
      '#............#',  //  5
      '#............#',  //  6
      '#............#',  //  7
      '#............#',  //  8
      '######|#######',  //  9   <- door between r2 and boss room
      '#............#',  // 10   r2
      '#............#',  // 11
      '#............#',  // 12
      '#............#',  // 13
      '#............#',  // 14
      '#............#',  // 15
      '######|#######',  // 16   <- door between r1 and r2
      '#............#',  // 17   r1
      '#............#',  // 18
      '#............#',  // 19
      '#............#',  // 20
      '#............#',  // 21
      '#......E.....#',  // 22   <- player entry spawn
      '##############',  // 23
    ],

    // ── Rooms (used to detect "room cleared" → open door) ────
    rooms: [
      { id: 'r1', yMin: 17, yMax: 22, xMin: 1, xMax: 12, isBossRoom: false },
      { id: 'r2', yMin: 10, yMax: 15, xMin: 1, xMax: 12, isBossRoom: false },
      { id: 'r3', yMin: 1,  yMax:  8, xMin: 1, xMax: 12, isBossRoom: true  },
    ],

    // ── Doors — closed until `unlockedBy` room is fully cleared.
    doors: [
      { x: 6, y: 16, unlockedBy: 'r1' },
      { x: 6, y: 9,  unlockedBy: 'r2' },
    ],

    // ── Mobs (non-boss). Position is tile coords. ────────────
    // Add/remove freely. cardId maps to ALL_CARDS; spriteKey is the
    // texture used to render the mob in the dungeon world (16x16
    // creature sprites, scaled up like overworld NPCs).
    mobs: [
      { mobId: 'logey_1',  cardId: 26, room: 'r1', x: 6, y: 19, spriteKey: 'creature_slime'    }, // Logey "Heinous" common
      { mobId: 'pelter_1', cardId: 86, room: 'r2', x: 6, y: 12, spriteKey: 'creature_mushroom' }, // Pelter "Snowball" rare
    ],

    // ── Final boss ────────────────────────────────────────────
    boss: {
      bossId: 'romy',
      cardId: 114, // Romy "Valley Guardian" legendary
      room: 'r3',
      x: 6, y: 4,
      spriteKey: 'creature_dragon',
    },

    // ── Tile palette (colors for the ice-cavern theme) ───────
    palette: {
      floor: 0xb8d4e6,       // icy floor
      floorAccent: 0x9bbed4, // subtle variation (used as random speckle)
      wall:  0x3a4a60,       // dark frosted stone
      doorClosed: 0x5a6878,
      doorOpen: 0xb8d4e6,
      stairs: 0xddeeff,
      stairsEdge: 0x88aacc,
      bg: 0x1a2230,          // camera background outside map
    },
  },
};

// Helper: resolve a dungeon config by id with a friendly error if missing.
function getDungeonConfig(id) {
  const cfg = DUNGEONS[id];
  if (!cfg) {
    console.error('[dungeons] Unknown dungeon id:', id, '— check dungeon-configs.js');
    return null;
  }
  return cfg;
}
