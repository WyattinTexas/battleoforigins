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

    // ── INTRO/POST hallway — King Jay cinematic ──────────────
    // Same map used for both the intro (player enters here, walks
    // up to King Jay who taunts and drops them through a trapdoor)
    // and the post (after beating the dungeon boss, player arrives
    // at the staircase at the north end, King Jay is gone, exits
    // via the south door). Skipped entirely once
    // G.frostDungeonCleared is true.
    intro: {
      mapAscii: [
        '########', //  0  top wall
        '#......#', //  1
        '#......#', //  2  staircase up appears here (post phase only)
        '#......#', //  3  King Jay spawns here (intro phase only)
        '#......#', //  4
        '#......#', //  5  trapdoor at (3,5) — 2 south of King Jay
        '#......#', //  6
        '#......#', //  7
        '#......#', //  8
        '#......#', //  9
        '#......#', // 10
        '#......#', // 11  player intro spawn here (south end)
        '#......#', // 12  exit door — active in post phase
        '########', // 13  bottom wall
      ],
      // All these positions are within the hallway grid above.
      // Centered on col 3 (8-wide map; cols 1-6 are floor).
      kingJay: {
        x: 3, y: 3,
        spriteKey: 'creature_skull',  // placeholder until custom NPC sprite designed
        name: 'King Jay',
        dialog: '"So, you found me. Think you got what it takes to beat me? Haha, show me what you got!"',
      },
      trapdoor: { x: 3, y: 5 },
      staircaseUp: { x: 3, y: 2 },     // where player arrives in post phase (from boss room)
      exitDoor: { x: 3, y: 12 },        // exits to overworld in post phase
      playerIntroSpawn: { x: 3, y: 11 }, // where player starts in intro phase
      postDialog: 'King Jay has escaped...',
    },

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
      floor: 0xb8d4e6,       // icy floor (fallback if floor sprites fail to load)
      floorAccent: 0x9bbed4,
      wall:  0x3a4a60,
      doorClosed: 0x5a6878,
      doorOpen: 0xb8d4e6,
      stairs: 0xddeeff,
      stairsEdge: 0x88aacc,
      bg: 0x080c14,          // very dark camera background outside map
    },

    // ── Decorative props ─────────────────────────────────────
    // Scattered through rooms for atmosphere. propKey matches the
    // 'd_prop_*' texture key loaded in BootScene. Position is tile
    // coords. Props render below player but above floor.
    props: [
      // Room 1 (entry room)
      { propKey: 'd_prop_crystals_small', x: 2,  y: 19 },
      { propKey: 'd_prop_old_crate',      x: 11, y: 18 },
      { propKey: 'd_prop_broken_sword',   x: 4,  y: 21 },
      { propKey: 'd_prop_stalagmite',     x: 9,  y: 20 },
      { propKey: 'd_prop_frost_pile',     x: 3,  y: 17 },
      // Room 2 (Pelter's room)
      { propKey: 'd_prop_skull',          x: 2,  y: 14 },
      { propKey: 'd_prop_frozen_barrel',  x: 11, y: 11 },
      { propKey: 'd_prop_crystals_lg',    x: 3,  y: 11 },
      { propKey: 'd_prop_stalagmite',     x: 10, y: 14 },
      // Room 3 (boss room)
      { propKey: 'd_prop_frozen_statue',  x: 2,  y: 2 },
      { propKey: 'd_prop_frozen_statue',  x: 11, y: 2 },
      { propKey: 'd_prop_crystals_lg',    x: 3,  y: 7 },
      { propKey: 'd_prop_crystals_small', x: 10, y: 7 },
      { propKey: 'd_prop_frost_pile',     x: 6,  y: 7 },
      { propKey: 'd_prop_skull',          x: 9,  y: 5 },
    ],

    // ── Lighting / vignette ──────────────────────────────────
    // All values here are tunable. Set `enabled: false` to disable
    // the whole effect at once. Other knobs let you shift intensity
    // without removing it. Per-dungeon, so you can tune each one.
    lighting: {
      enabled: true,
      vignetteAlpha: 0.85,    // 0..1 — how dark the corners get
      ambientTint: 0x081428,  // hex — global blue ambient cast on the dungeon
      ambientTintAlpha: 0.18, // 0..1 — strength of the cast
      torchLightRadius: 80,   // px — size of warm halo per torch
      torchLightAlpha: 0.42,  // 0..1 — strength of torch halos
      snowEnabled: true,      // drifting ambient snow particles
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
