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
    aggroRadius: 4,            // mobs start chasing when within this tile distance (Chebyshev)
    mobStepIntervalMs: 480,    // mob takes one step every N ms while in aggro range
    bossAggro: false,          // boss stays put as a chokepoint (true to make it chase too)
    bossHpMultiplier: 3,       // boss HP = card.maxHp * 3 (matches world boss scaling)
    mobHpMultiplier: 1,        // common mob HP scaling (1 = card default)
    bossRewardGold: 100,       // gold awarded on final boss defeat
    // Fog of war — reveal tiles within LOS of the player; visited tiles
    // stay dimly visible as "memory". Skipped in intro/post hallway phases.
    fog: {
      enabled: true,
      radius: 7,               // tile radius around player (was 5 — felt too tight 2026-05-15)
      dimAlpha: 0.55,          // alpha of visited-but-not-visible tiles (0=clear, 1=black)
    },
    // Test flag — when true, walking into ANY enemy (mob or boss)
    // instantly defeats it with no battle. Covers the full path:
    // mobs in r1/r2 + Romy in r3. Use this to verify the post-phase
    // flow without dice variance. Flip to false for real play.
    instaWin: false,

    // Earlier debug flag (force every spiritkin to 1HP). Left in
    // place for reference but disabled — 1HP still requires winning
    // a dice round to land the killing blow, so it doesn't give a
    // reliable test path. instaWin above is the right tool here.
    debugAllHpOne: false,

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
      // Trapdoor spans the FULL WIDTH of the hallway floor (cols 1..6
      // = 6 tiles wide) so the player can't walk around it. 2 tiles
      // tall. Player snaps to the dead center before falling.
      trapdoor: { x: 1, y: 5, w: 6, h: 2, spriteKey: 'd_trapdoor_wide' },
      staircaseUp: { x: 3, y: 2 },     // where player arrives in post phase (from boss room)
      exitDoor: { x: 3, y: 12 },        // exits to overworld in post phase
      playerIntroSpawn: { x: 3, y: 11 }, // where player starts in intro phase
      postDialog: 'King Jay has escaped...',
    },

    // ── Map (each row is a string of single-char tiles) ──────
    // Chars: '#'=wall, '.'=floor, '|'=closed door, 'E'=entry spawn, 'S'=staircase spawn slot
    // The grid is parsed by DungeonScene into the D_TILE numeric grid.
    // Width/height auto-derived from this array.
    //
    // Organic 24×28 layout — three irregular rooms connected by long
    // twisting corridors. Designed to look like a real cavern rather than
    // a corridor of identical rectangles, and to play well with fog-of-war
    // when that lands. Generated from /tmp/carve_dungeon.py.
    //
    //   r3 BOSS  (NW, L-shape: wide top + south stem)
    //     │
    //     C3 (south → east → south, ~7 tiles)
    //     │
    //   r2 PELTER (mid-east, kidney shape with alcove + nook)
    //     │
    //     C2 (south → west → south, ~8 tiles)
    //     │
    //   r1 LOGEY (SW, L-shape: vertical stem + east hook)
    //     │
    //     C1 (south → east, ~6 tiles)
    //     │
    //   E entry foyer (SE corner)
    mapAscii: [
      '########################',  //  0
      '##...........###########',  //  1   r3 BOSS — wide top
      '#.............##########',  //  2
      '#.....S.......##########',  //  3
      '##...........###########',  //  4
      '#########....###########',  //  5   r3 south stem
      '#########....###########',  //  6
      '#########....###########',  //  7
      '#########....###########',  //  8
      '##########..############',  //  9   C3 corridor — narrows
      '##########|#############',  // 10   <- D2 door, gated by r2 (Pelter)
      '##########.......#....##',  // 11   C3 turns east + r2 top alcove
      '###########...........##',  // 12
      '##############........##',  // 13   r2 PELTER — main body
      '##############........##',  // 14
      '##############...##...##',  // 15   r2 kidney pinch
      '##############...#....##',  // 16
      '##############....######',  // 17   r2 bottom nook
      '##############....######',  // 18
      '###############|########',  // 19   <- D1 door, gated by r1 (Logey)
      '###############..#######',  // 20   C2 corridor — south leg
      '###.....##.......#######',  // 21   C2 turns west
      '##......##.....#########',  // 22
      '##..........############',  // 23   r1 LOGEY — east hook
      '##..........############',  // 24
      '###.........############',  // 25   r1 vertical stem (south end)
      '#####.......E..#########',  // 26   C1 + entry foyer
      '########################',  // 27
    ],

    // ── Rooms (used to detect "room cleared" → open door) ────
    // Bounding boxes that contain each room's irregular shape. Mobs are
    // matched to rooms by the `room:` field on the mob entry below, so
    // these bounds are mainly for torch placement + future fog-of-war
    // region detection. Corridors are NOT tracked rooms.
    rooms: [
      { id: 'r1', yMin: 21, yMax: 25, xMin: 2,  xMax: 11, isBossRoom: false },
      { id: 'r2', yMin: 11, yMax: 18, xMin: 14, xMax: 21, isBossRoom: false },
      { id: 'r3', yMin: 1,  yMax:  8, xMin: 1,  xMax: 13, isBossRoom: true  },
    ],

    // ── Doors — closed until `unlockedBy` room is fully cleared.
    // Each sits at a single-tile chokepoint on the corridor between
    // its gated room and the next region north.
    doors: [
      { x: 15, y: 19, unlockedBy: 'r1' },
      { x: 10, y: 10, unlockedBy: 'r2' },
    ],

    // ── Mobs (non-boss). Position is tile coords. ────────────
    mobs: [
      { mobId: 'logey_1',  cardId: 26, room: 'r1', x: 5,  y: 23, spriteKey: 'creature_slime'    }, // Logey "Heinous" common
      { mobId: 'pelter_1', cardId: 86, room: 'r2', x: 17, y: 14, spriteKey: 'creature_mushroom' }, // Pelter "Snowball" rare
    ],

    // ── Final boss ────────────────────────────────────────────
    boss: {
      bossId: 'romy',
      cardId: 114, // Romy "Valley Guardian" legendary
      room: 'r3',
      x: 7, y: 3,
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
      // r3 BOSS ROOM (rows 1-8) — throne arena, most decorated
      { propKey: 'd_prop_icicles',        x: 3,  y: 1 },
      { propKey: 'd_prop_icicles',        x: 10, y: 1 },
      { propKey: 'd_prop_frozen_statue',  x: 2,  y: 2 },
      { propKey: 'd_prop_frozen_statue',  x: 12, y: 2 },
      { propKey: 'd_prop_crystals_lg',    x: 4,  y: 3 },
      { propKey: 'd_prop_ice_geode',      x: 11, y: 3 },
      { propKey: 'd_prop_skull',          x: 3,  y: 4 },
      { propKey: 'd_prop_frost_pile',     x: 11, y: 4 },
      // r3 south stem (cols 9-12, rows 5-8) — narrow approach
      { propKey: 'd_prop_icicles',        x: 10, y: 6 },
      { propKey: 'd_prop_ice_geode',      x: 10, y: 7 },
      // C3 corridor turns
      { propKey: 'd_prop_icicles',        x: 10, y: 11 },
      { propKey: 'd_prop_crystals_small', x: 11, y: 12 },
      // r2 PELTER (rows 11-18) — kidney room, magical/icy
      { propKey: 'd_prop_crystals_small', x: 19, y: 11 },   // top alcove
      { propKey: 'd_prop_frost_pile',     x: 20, y: 11 },
      { propKey: 'd_prop_crystals_lg',    x: 15, y: 13 },
      { propKey: 'd_prop_skull',          x: 20, y: 13 },
      { propKey: 'd_prop_frozen_barrel',  x: 15, y: 17 },   // bottom nook
      { propKey: 'd_prop_stalagmite',     x: 16, y: 17 },
      // C2 corridor — south leg
      { propKey: 'd_prop_crystals_small', x: 15, y: 20 },
      // r1 LOGEY (rows 21-25) — entry room, "ruined" feel
      { propKey: 'd_prop_crystals_small', x: 4,  y: 21 },
      { propKey: 'd_prop_old_crate',      x: 3,  y: 24 },
      { propKey: 'd_prop_stalagmite',     x: 10, y: 24 },
      { propKey: 'd_prop_frost_pile',     x: 8,  y: 23 },
      { propKey: 'd_prop_broken_sword',   x: 5,  y: 25 },
      // C1 + entry foyer (row 26)
      { propKey: 'd_prop_frost_pile',     x: 8,  y: 26 },
      { propKey: 'd_prop_crystals_small', x: 14, y: 26 },
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
