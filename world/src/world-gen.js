// ═══ Simple 2D value noise for organic tree placement ═══
function _hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}
function _noise2d(x, y, freq) {
  const fx = x * freq, fy = y * freq;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const dx = fx - ix, dy = fy - iy;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const n00 = _hash(ix, iy) / 0x7fffffff;
  const n10 = _hash(ix + 1, iy) / 0x7fffffff;
  const n01 = _hash(ix, iy + 1) / 0x7fffffff;
  const n11 = _hash(ix + 1, iy + 1) / 0x7fffffff;
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}
// Multi-octave noise: returns 0-1
function forestNoise(x, y, seed) {
  const s = seed || 0;
  const n1 = _noise2d(x + s, y + s, 0.12);       // large forest shapes
  const n2 = _noise2d(x + s + 100, y + s + 100, 0.25) * 0.4; // medium detail
  const n3 = _noise2d(x + s + 200, y + s + 200, 0.5) * 0.15; // small clumps
  return Math.min(1, Math.max(0, n1 + n2 + n3));
}

// ═══ ZONE-SPECIFIC ENCOUNTER ZONES ═══
// Each zone gets its own set. Coordinates are within the 110x85 map.
const ZONE_ENCOUNTER_ZONES = {
  frost_valley: [
    { name: 'Crystal Glade', x: 25, y: 12, w: 8, h: 6 },
    { name: 'Frozen Hollow', x: 8, y: 28, w: 7, h: 5 },
    { name: 'Aurora Fields', x: 40, y: 8, w: 7, h: 5 },
    { name: 'Shimmer Basin', x: 30, y: 38, w: 9, h: 5 },
    { name: 'Permafrost Depths', x: 48, y: 28, w: 6, h: 6 },
    { name: 'Snowdrift Pass', x: 70, y: 15, w: 7, h: 5 },
    { name: 'Icebound Thicket', x: 85, y: 10, w: 8, h: 6 },
    { name: 'Frostfire Clearing', x: 60, y: 45, w: 7, h: 5 },
    { name: 'Glacier Rim', x: 90, y: 40, w: 6, h: 5 },
    { name: 'Whiteout Plains', x: 15, y: 55, w: 8, h: 6 },
    { name: 'Crystal Cavern', x: 50, y: 60, w: 7, h: 5 },
    { name: 'Northern Expanse', x: 75, y: 55, w: 8, h: 6 },
  ],
  rolling_hills: [
    { name: 'Sunlit Meadow', x: 12, y: 12, w: 8, h: 6 },
    { name: 'Bramble Thicket', x: 35, y: 15, w: 7, h: 5 },
    { name: 'Golden Fields', x: 60, y: 10, w: 8, h: 6 },
    { name: 'Windmill Rise', x: 85, y: 12, w: 7, h: 5 },
    { name: 'Flower Basin', x: 20, y: 35, w: 8, h: 6 },
    { name: 'Harvest Hollow', x: 48, y: 38, w: 7, h: 5 },
    { name: 'Amber Grove', x: 75, y: 35, w: 7, h: 6 },
    { name: 'Dewdrop Glen', x: 15, y: 55, w: 8, h: 5 },
    { name: 'Clover Patch', x: 40, y: 58, w: 7, h: 5 },
    { name: 'Shepherd\'s Rest', x: 65, y: 55, w: 8, h: 6 },
    { name: 'Honeycomb Valley', x: 90, y: 50, w: 6, h: 5 },
  ],
  volcanic_isles: [
    { name: 'Magma Pools', x: 20, y: 15, w: 7, h: 5 },
    { name: 'Obsidian Fields', x: 50, y: 12, w: 8, h: 6 },
    { name: 'Lava Shores', x: 80, y: 10, w: 7, h: 5 },
    { name: 'Ember Reef', x: 15, y: 38, w: 6, h: 5 },
    { name: 'Ash Wastes', x: 40, y: 35, w: 8, h: 6 },
    { name: 'Caldera Basin', x: 70, y: 38, w: 7, h: 5 },
    { name: 'Scorched Beach', x: 90, y: 35, w: 7, h: 5 },
    { name: 'Sulfur Springs', x: 25, y: 55, w: 7, h: 5 },
    { name: 'Cinder Flats', x: 55, y: 58, w: 8, h: 6 },
    { name: 'Volcanic Coast', x: 80, y: 55, w: 7, h: 5 },
  ],
  dark_castle: [
    { name: 'Shadow Realm', x: 15, y: 10, w: 7, h: 5 },
    { name: 'Throne Approach', x: 50, y: 12, w: 6, h: 6 },
    { name: 'Crypt Gardens', x: 80, y: 10, w: 7, h: 5 },
    { name: 'Bone Yard', x: 20, y: 35, w: 8, h: 6 },
    { name: 'Witch\'s Hollow', x: 55, y: 38, w: 7, h: 5 },
    { name: 'Obsidian Tower', x: 85, y: 35, w: 6, h: 5 },
    { name: 'Cursed Courtyard', x: 15, y: 55, w: 8, h: 6 },
    { name: 'Spectral Ruins', x: 45, y: 58, w: 7, h: 5 },
    { name: 'Dark Sanctum', x: 75, y: 55, w: 7, h: 5 },
  ],
};

// Active encounter zones for the current zone (mutable reference)
let ENCOUNTER_ZONES = ZONE_ENCOUNTER_ZONES.frost_valley;

// 0=snow, 1=tree, 2=path, 3=water, 4=ice, 5=building, 6=encounter_zone, 7=mountain, 8=craft_building, 9=grass, 10=flowers, 11=rolling_hill, 12=cantina, 13=warm_tree, 19=plaza, 20=sand, 21=palm_tree
// 22=dark_stone, 23=dark_wall, 24=dark_path, 25=dark_tree, 26=castle_floor, 27=dungeons, 28=frost_dungeon
let worldMap = [];

// ═══ ZONE ADJACENCY MAP ═══
// Defines which zones connect at which edges.
// edge: 'south'|'east'|'north'|'west', target: zoneId, spawnEdge: where player appears in target
const ZONE_ADJACENCY = {
  frost_valley: [
    { edge: 'south', target: 'rolling_hills', spawnEdge: 'north' },
    { edge: 'east', target: 'volcanic_isles', spawnEdge: 'west' },
  ],
  rolling_hills: [
    { edge: 'north', target: 'frost_valley', spawnEdge: 'south' },
    { edge: 'east', target: 'volcanic_isles', spawnEdge: 'west' },
  ],
  volcanic_isles: [
    { edge: 'west', target: 'frost_valley', spawnEdge: 'east' },
    { edge: 'east', target: 'dark_castle', spawnEdge: 'west' },
  ],
  dark_castle: [
    { edge: 'west', target: 'volcanic_isles', spawnEdge: 'east' },
  ],
};

// ═══ ZONE-SPECIFIC HUB POSITIONS ═══
// Each zone has its hub at a good central location within the full 110x85 map.
const ZONE_HUBS = {
  frost_valley:   { x: 15, y: 20 },
  rolling_hills:  { x: 28, y: 25 },
  volcanic_isles: { x: 30, y: 28 },
  dark_castle:    { x: 25, y: 20 },
};

// ═══════ MAIN GENERATION — dispatches to zone-specific generators ═══════
function generateWorld(zoneId) {
  zoneId = zoneId || 'frost_valley';

  // Update ENCOUNTER_ZONES reference for this zone
  ENCOUNTER_ZONES = ZONE_ENCOUNTER_ZONES[zoneId] || ZONE_ENCOUNTER_ZONES.frost_valley;

  worldMap = [];
  for (let y = 0; y < WORLD_H; y++) {
    worldMap[y] = [];
    for (let x = 0; x < WORLD_W; x++) {
      worldMap[y][x] = 0;
    }
  }

  switch (zoneId) {
    case 'frost_valley':   _generateFrostValley(); break;
    case 'rolling_hills':  _generateRollingHills(); break;
    case 'volcanic_isles': _generateVolcanicIsles(); break;
    case 'dark_castle':    _generateDarkCastle(); break;
    default:               _generateFrostValley(); break;
  }

  // ── Universal post-processing: clear trees near paths/buildings ──
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    if (worldMap[y][x] === 2 || worldMap[y][x] === 5 || worldMap[y][x] === 8 || worldMap[y][x] === 12 || worldMap[y][x] === 19 || worldMap[y][x] === 27 || worldMap[y][x] === 28) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ny = y+dy, nx = x+dx;
        if (ny >= 0 && ny < WORLD_H && nx >= 0 && nx < WORLD_W) {
          const t = worldMap[ny][nx];
          if (t === 1 || t === 13) worldMap[ny][nx] = (zoneId === 'rolling_hills' ? 9 : 0);
          if (t === 21) worldMap[ny][nx] = (zoneId === 'volcanic_isles' ? 17 : 20);
          if (t === 25) worldMap[ny][nx] = 22;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// FROST VALLEY — Full 110x85 map: snow, ice, frozen lakes, pine forests
// ═══════════════════════════════════════════════════════════════
function _generateFrostValley() {
  // Base: all snow
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++)
      worldMap[y][x] = 0;

  // Border mountains on 3 sides (north, west, top of east) — south+east open for transitions
  for (let x = 0; x < WORLD_W; x++) { worldMap[0][x] = 7; worldMap[1][x] = 7; }
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][0] = 7; worldMap[y][1] = 7; }
  // North border
  for (let x = 0; x < WORLD_W; x++) { worldMap[0][x] = 7; worldMap[1][x] = 7; }

  // South border mountains with passage gaps (transition to Rolling Hills)
  for (let x = 0; x < WORLD_W; x++) { worldMap[WORLD_H-1][x] = 7; worldMap[WORLD_H-2][x] = 7; }
  // South passage gap (centered around x:50-59)
  for (let x = 48; x <= 61; x++) { worldMap[WORLD_H-1][x] = 2; worldMap[WORLD_H-2][x] = 2; }

  // East border mountains with passage gap (transition to Volcanic Isles)
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][WORLD_W-1] = 7; worldMap[y][WORLD_W-2] = 7; }
  // East passage gap (centered around y:38-47)
  for (let y = 36; y <= 49; y++) { worldMap[y][WORLD_W-1] = 2; worldMap[y][WORLD_W-2] = 2; }

  // West border
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][0] = 7; worldMap[y][1] = 7; }

  const hub = ZONE_HUBS.frost_valley;

  // ═══ FROZEN LAKE (larger, central-north area) ═══
  // Main lake
  for (let y = 18; y < 28; y++) for (let x = 35; x < 52; x++) worldMap[y][x] = 4; // ice border
  for (let y = 19; y < 27; y++) for (let x = 36; x < 51; x++) worldMap[y][x] = 3; // water center

  // Second frozen lake (eastern area)
  for (let y = 12; y < 18; y++) for (let x = 75; x < 88; x++) worldMap[y][x] = 4;
  for (let y = 13; y < 17; y++) for (let x = 76; x < 87; x++) worldMap[y][x] = 3;

  // Small pond (southwest)
  for (let y = 55; y < 60; y++) for (let x = 15; x < 22; x++) worldMap[y][x] = 4;
  for (let y = 56; y < 59; y++) for (let x = 16; x < 21; x++) worldMap[y][x] = 3;

  // ═══ TREES — noise-based organic forests across full map ═══
  for (let y = 3; y < WORLD_H - 3; y++) {
    for (let x = 3; x < WORLD_W - 3; x++) {
      if (worldMap[y][x] !== 0) continue;
      // Hub area exclusion
      if (x >= hub.x - 3 && x <= hub.x + 12 && y >= hub.y - 3 && y <= hub.y + 12) continue;
      // Lake exclusions
      if (x >= 33 && x <= 53 && y >= 16 && y <= 29) continue;
      if (x >= 73 && x <= 89 && y >= 10 && y <= 19) continue;
      if (x >= 13 && x <= 23 && y >= 53 && y <= 61) continue;
      // Keep passage corridors clear
      if (y >= WORLD_H - 6 && x >= 45 && x <= 64) continue; // south passage
      if (x >= WORLD_W - 6 && y >= 33 && y <= 52) continue; // east passage

      const density = forestNoise(x, y, 42);
      if (density > 0.78) {
        worldMap[y][x] = 1;
      } else if (density > 0.70) {
        const edgeChance = (density - 0.70) / 0.08;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.25) {
          worldMap[y][x] = 1;
        }
      }
    }
  }

  // ═══ PATHS — extensive road network ═══
  // Main horizontal path through center
  for (let x = 2; x < WORLD_W - 2; x++) {
    const py = 30 + Math.floor(Math.sin(x * 0.2) * 2);
    if (py >= 2 && py < WORLD_H - 2) { worldMap[py][x] = 2; worldMap[py+1][x] = 2; }
  }
  // Vertical path from north to hub
  for (let y = 4; y < hub.y + 8; y++) { worldMap[y][hub.x + 2] = 2; worldMap[y][hub.x + 3] = 2; }
  // Path from hub south to south passage
  for (let y = hub.y + 8; y < WORLD_H - 2; y++) {
    const px = hub.x + 2 + Math.floor((y - hub.y - 8) / (WORLD_H - hub.y - 10) * (54 - hub.x - 2));
    if (px >= 2 && px < WORLD_W - 2) { worldMap[y][px] = 2; if (px+1 < WORLD_W-2) worldMap[y][px+1] = 2; }
  }
  // Path from hub east to east passage
  for (let x = hub.x + 10; x < WORLD_W - 2; x++) {
    const py = 40 + Math.floor(Math.sin(x * 0.15) * 3);
    if (py >= 2 && py < WORLD_H - 2) { worldMap[py][x] = 2; worldMap[py+1][x] = 2; }
  }
  // Secondary paths connecting encounter zones
  for (let y = 8; y < 20; y++) { worldMap[y][25] = 2; worldMap[y][26] = 2; } // to Crystal Glade
  for (let y = 38; y < 50; y++) { worldMap[y][70] = 2; worldMap[y][71] = 2; } // to Snowdrift area
  // Path from second lake west
  for (let x = 52; x < 75; x++) { worldMap[15][x] = 2; worldMap[16][x] = 2; }

  // ═══ POLARIS HUB TOWN ═══
  const hubX = hub.x, hubY = hub.y;
  // Clear area
  for (let y = hubY - 1; y < hubY + 10; y++) {
    for (let x = hubX - 1; x < hubX + 10; x++) {
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2;
    }
  }
  // Central plaza
  const plazaCX = hubX + 2, plazaCY = hubY + 2;
  for (let y = plazaCY; y < plazaCY + 4; y++)
    for (let x = plazaCX; x < plazaCX + 4; x++)
      worldMap[y][x] = 19;
  // Plaza border
  for (let x = plazaCX - 1; x <= plazaCX + 4; x++) {
    if (x >= 2 && x < WORLD_W - 2) { worldMap[plazaCY - 1][x] = 2; worldMap[plazaCY + 4][x] = 2; }
  }
  for (let y = plazaCY; y < plazaCY + 4; y++) { worldMap[y][plazaCX - 1] = 2; worldMap[y][plazaCX + 4] = 2; }
  // Buildings
  worldMap[hubY+1][hubX+1] = 5; worldMap[hubY+1][hubX+2] = 5; // trading post
  worldMap[hubY+1][hubX+5] = 5; worldMap[hubY+1][hubX+6] = 5; // arena
  worldMap[hubY+3][hubX+1] = 8; worldMap[hubY+3][hubX+2] = 8; // workshop
  worldMap[hubY+3][hubX+5] = 5; worldMap[hubY+3][hubX+6] = 5; // inn
  // Cantina
  worldMap[hubY+5][hubX+3] = 12; worldMap[hubY+5][hubX+4] = 12;
  worldMap[hubY+4][hubX+3] = 2; worldMap[hubY+4][hubX+4] = 2;
  worldMap[hubY+5][hubX+2] = 2; worldMap[hubY+5][hubX+5] = 2;
  // Dungeons entrance
  worldMap[hubY+7][hubX+3] = 27; worldMap[hubY+7][hubX+4] = 27;
  worldMap[hubY+6][hubX+3] = 2; worldMap[hubY+6][hubX+4] = 2;
  worldMap[hubY+7][hubX+2] = 2; worldMap[hubY+7][hubX+5] = 2;
  // Hub approach paths
  for (let y = hubY - 3; y < hubY - 1; y++)
    for (let x = hubX + 1; x < hubX + 5; x++)
      if (y >= 2) worldMap[y][x] = 2;
  for (let y = hubY + 10; y < hubY + 12; y++)
    for (let x = hubX + 1; x < hubX + 5; x++)
      if (y < WORLD_H - 2) worldMap[y][x] = 2;

  // Frost Dungeon entrance (top area)
  const fdx = 38, fdy = 5;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      worldMap[fdy + dy][fdx + dx] = 28;
  worldMap[fdy + 2][fdx] = 2;

  // ═══ SECONDARY SETTLEMENT: Snowpeak Outpost (eastern area) ═══
  const spX = 78, spY = 30;
  for (let y = spY - 1; y < spY + 5; y++)
    for (let x = spX - 1; x < spX + 6; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2;
  worldMap[spY+1][spX+1] = 5; // outpost inn
  worldMap[spY+1][spX+3] = 5; // lookout tower
  worldMap[spY+3][spX+2] = 5; // supply depot

  // ═══ THIRD SETTLEMENT: Frostwatch Camp (southern area) ═══
  const fwX = 40, fwY = 60;
  for (let y = fwY - 1; y < fwY + 4; y++)
    for (let x = fwX - 1; x < fwX + 5; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2;
  worldMap[fwY+1][fwX+1] = 5; // ranger cabin
  worldMap[fwY+1][fwX+3] = 5; // warming hut

  // More ice patches scattered around
  const iceClusters = [
    {x:10,y:10,w:4,h:3}, {x:60,y:8,w:5,h:3}, {x:95,y:25,w:4,h:3},
    {x:50,y:50,w:5,h:4}, {x:85,y:60,w:4,h:3}, {x:25,y:70,w:5,h:3},
  ];
  for (const ic of iceClusters) {
    for (let dy = 0; dy < ic.h; dy++)
      for (let dx = 0; dx < ic.w; dx++) {
        const iy = ic.y + dy, ix = ic.x + dx;
        if (iy >= 2 && iy < WORLD_H - 2 && ix >= 2 && ix < WORLD_W - 2 && worldMap[iy][ix] === 0)
          worldMap[iy][ix] = 4;
      }
  }
}

// ═══════════════════════════════════════════════════════════════
// ROLLING HILLS — Full 110x85 map: grass, flowers, warm trees, meadows
// ═══════════════════════════════════════════════════════════════
function _generateRollingHills() {
  // Base: all grass
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++)
      worldMap[y][x] = 9;

  // Border mountains — north open for Frost Valley, east open for Volcanic Isles
  // South + West borders closed
  for (let x = 0; x < WORLD_W; x++) { worldMap[WORLD_H-1][x] = 7; worldMap[WORLD_H-2][x] = 7; }
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][0] = 7; worldMap[y][1] = 7; }

  // North border with passage gap (from Frost Valley)
  for (let x = 0; x < WORLD_W; x++) { worldMap[0][x] = 7; worldMap[1][x] = 7; }
  for (let x = 48; x <= 61; x++) { worldMap[0][x] = 9; worldMap[1][x] = 9; }

  // East border with passage gap (to Volcanic Isles)
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][WORLD_W-1] = 7; worldMap[y][WORLD_W-2] = 7; }
  for (let y = 36; y <= 49; y++) { worldMap[y][WORLD_W-1] = 9; worldMap[y][WORLD_W-2] = 9; }

  const hub = ZONE_HUBS.rolling_hills;

  // ═══ FLOWER PATCHES (lots of them across the map) ═══
  for (let i = 0; i < 200; i++) {
    const fx = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const fy = 4 + Math.floor(Math.random() * (WORLD_H - 8));
    if (worldMap[fy][fx] === 9) worldMap[fy][fx] = 10;
  }

  // ═══ ROLLING HILL MOUNDS ═══
  for (let i = 0; i < 60; i++) {
    const hx = 5 + Math.floor(Math.random() * (WORLD_W - 10));
    const hy = 5 + Math.floor(Math.random() * (WORLD_H - 10));
    if (worldMap[hy][hx] === 9) {
      worldMap[hy][hx] = 11;
      if (hx+1 < WORLD_W - 2 && worldMap[hy][hx+1] === 9) worldMap[hy][hx+1] = 11;
    }
  }

  // ═══ WARM TREES — noise-based organic groves ═══
  for (let y = 3; y < WORLD_H - 3; y++) {
    for (let x = 3; x < WORLD_W - 3; x++) {
      if (worldMap[y][x] !== 9) continue;
      // Hub exclusion
      if (Math.abs(x - hub.x) < 8 && Math.abs(y - hub.y) < 8) continue;
      // Passage exclusions
      if (y <= 4 && x >= 45 && x <= 64) continue;
      if (x >= WORLD_W - 5 && y >= 33 && y <= 52) continue;

      const density = forestNoise(x, y, 77);
      if (density > 0.80) {
        worldMap[y][x] = 13;
      } else if (density > 0.72) {
        const edgeChance = (density - 0.72) / 0.08;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.2) {
          worldMap[y][x] = 13;
        }
      }
    }
  }

  // ═══ WATER FEATURES ═══
  // Main pond (near hub)
  for (let y = hub.y + 12; y < hub.y + 18; y++)
    for (let x = hub.x + 8; x < hub.x + 15; x++)
      if (y < WORLD_H - 2 && x < WORLD_W - 2) worldMap[y][x] = 3;
  // Ice edges
  for (let x = hub.x + 7; x < hub.x + 16; x++) {
    if (hub.y + 11 >= 2 && x < WORLD_W - 2) worldMap[hub.y + 11][x] = 4;
    if (hub.y + 18 < WORLD_H - 2 && x < WORLD_W - 2) worldMap[hub.y + 18][x] = 4;
  }

  // Winding river (east side)
  for (let y = 5; y < WORLD_H - 5; y++) {
    const rx = 80 + Math.floor(Math.sin(y * 0.15) * 5);
    if (rx >= 2 && rx < WORLD_W - 4) {
      worldMap[y][rx] = 3; worldMap[y][rx+1] = 3;
    }
  }

  // Small lakes scattered
  const lakes = [{x:15,y:55,w:5,h:4}, {x:65,y:20,w:4,h:3}, {x:90,y:65,w:4,h:3}];
  for (const lk of lakes) {
    for (let dy = 0; dy < lk.h; dy++)
      for (let dx = 0; dx < lk.w; dx++) {
        const ly = lk.y + dy, lx = lk.x + dx;
        if (ly >= 2 && ly < WORLD_H - 2 && lx >= 2 && lx < WORLD_W - 2) worldMap[ly][lx] = 3;
      }
  }

  // ═══ PATHS ═══
  // Main horizontal
  for (let x = 2; x < WORLD_W - 2; x++) {
    const py = 30 + Math.floor(Math.sin(x * 0.2) * 2);
    if (py >= 2 && py < WORLD_H - 2) { worldMap[py][x] = 2; worldMap[py+1][x] = 2; }
  }
  // North entrance path down to hub
  for (let y = 2; y < hub.y; y++) {
    const px = 54 + Math.floor((y / hub.y) * (hub.x - 54 + 3));
    if (px >= 2 && px < WORLD_W - 2) { worldMap[y][px] = 2; worldMap[y][px+1] = 2; }
  }
  // Hub to east passage
  for (let x = hub.x + 8; x < WORLD_W - 2; x++) {
    const py = 42 + Math.floor(Math.sin(x * 0.15) * 2);
    if (py >= 2 && py < WORLD_H - 2) { worldMap[py][x] = 2; worldMap[py+1][x] = 2; }
  }
  // Hub south road
  for (let y = hub.y + 6; y < WORLD_H - 4; y++) {
    const px = hub.x + 3 + Math.floor(Math.sin(y * 0.1) * 2);
    if (px >= 2 && px < WORLD_W - 2) { worldMap[y][px] = 2; worldMap[y][px+1] = 2; }
  }

  // ═══ MEADOWBROOK HUB ═══
  const hubX = hub.x, hubY = hub.y;
  for (let y = hubY - 1; y < hubY + 8; y++)
    for (let x = hubX - 2; x < hubX + 9; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2;
  // Plaza
  for (let y = hubY + 1; y < hubY + 5; y++)
    for (let x = hubX; x < hubX + 7; x++)
      worldMap[y][x] = 19;
  // Buildings
  worldMap[hubY+1][hubX+1] = 5; // inn
  worldMap[hubY+1][hubX+3] = 5; // seed shop
  worldMap[hubY+1][hubX+5] = 5; // meadow hall
  worldMap[hubY+3][hubX+1] = 5; // herbalist
  worldMap[hubY+3][hubX+3] = 5; // greenhouse
  worldMap[hubY+3][hubX+5] = 8; // workshop
  worldMap[hubY+5][hubX+2] = 12; // tavern
  worldMap[hubY+5][hubX+4] = 5; // market

  // ═══ SECONDARY SETTLEMENT: Harvest Village (southeast) ═══
  const hvX = 70, hvY = 55;
  for (let y = hvY - 1; y < hvY + 5; y++)
    for (let x = hvX - 1; x < hvX + 6; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2;
  worldMap[hvY+1][hvX+1] = 5; // farmhouse
  worldMap[hvY+1][hvX+3] = 5; // granary
  worldMap[hvY+3][hvX+2] = 5; // windmill

  // ═══ THIRD SETTLEMENT: Shepherd's Camp (northwest) ═══
  const scX = 15, scY = 15;
  for (let y = scY - 1; y < scY + 4; y++)
    for (let x = scX - 1; x < scX + 5; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2;
  worldMap[scY+1][scX+1] = 5;
  worldMap[scY+1][scX+3] = 5;
}

// ═══════════════════════════════════════════════════════════════
// VOLCANIC ISLES — Full 110x85 map: ash, lava, obsidian, palm trees, beaches
// ═══════════════════════════════════════════════════════════════
function _generateVolcanicIsles() {
  // Base: ash ground
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++)
      worldMap[y][x] = 17;

  // Border: ocean water on 3 sides (north, south, east), west open
  // West border: mountains with passage gap (from Frost Valley / Rolling Hills)
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][0] = 7; worldMap[y][1] = 7; }
  for (let y = 36; y <= 49; y++) { worldMap[y][0] = 2; worldMap[y][1] = 2; }

  // North ocean
  for (let x = 0; x < WORLD_W; x++) { worldMap[0][x] = 3; worldMap[1][x] = 3; worldMap[2][x] = 3; }
  // South ocean
  for (let x = 0; x < WORLD_W; x++) { worldMap[WORLD_H-1][x] = 3; worldMap[WORLD_H-2][x] = 3; worldMap[WORLD_H-3][x] = 3; }

  // East border: mountains with passage gap (to Dark Castle)
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][WORLD_W-1] = 7; worldMap[y][WORLD_W-2] = 7; }
  for (let y = 36; y <= 49; y++) { worldMap[y][WORLD_W-1] = 2; worldMap[y][WORLD_W-2] = 2; }

  // ═══ SAND BEACHES (3 tiles wide around ocean edges) ═══
  for (let x = 4; x < WORLD_W - 4; x++) {
    worldMap[3][x] = 20; worldMap[4][x] = 20; worldMap[5][x] = 20;
    worldMap[WORLD_H-4][x] = 20; worldMap[WORLD_H-5][x] = 20; worldMap[WORLD_H-6][x] = 20;
  }

  // ═══ VOLCANO LANDMARK — huge central volcano ═══
  const vcx = 55, vcy = 35;
  // Outer volcanic rock ring (11x11)
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const vx = vcx + dx, vy = vcy + dy;
    if (vx >= 4 && vx < WORLD_W - 4 && vy >= 6 && vy < WORLD_H - 6)
      worldMap[vy][vx] = 14;
  }
  // Obsidian ring (8x8)
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    worldMap[vcy + dy][vcx + dx] = 16;
  }
  // Lava core (5x5)
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    worldMap[vcy + dy][vcx + dx] = 15;
  }

  // ═══ LAVA RIVERS from volcano in 4 directions ═══
  // North
  for (let y = 8; y < vcy - 5; y++) {
    const lx = vcx + Math.floor(Math.sin(y * 0.5) * 3);
    if (lx >= 4 && lx < WORLD_W - 4) { worldMap[y][lx] = 15; if (lx+1 < WORLD_W-4) worldMap[y][lx+1] = 15; }
  }
  // South
  for (let y = vcy + 6; y < WORLD_H - 7; y++) {
    const lx = vcx + Math.floor(Math.sin(y * 0.4) * 3);
    if (lx >= 4 && lx < WORLD_W - 4) { worldMap[y][lx] = 15; }
  }
  // East
  for (let x = vcx + 6; x < WORLD_W - 6; x++) {
    const ly = vcy + Math.floor(Math.sin(x * 0.6) * 3);
    if (ly >= 6 && ly < WORLD_H - 6) { worldMap[ly][x] = 15; }
  }
  // West
  for (let x = 6; x < vcx - 5; x++) {
    const ly = vcy + Math.floor(Math.sin(x * 0.5) * 3);
    if (ly >= 6 && ly < WORLD_H - 6) { worldMap[ly][x] = 15; }
  }

  // ═══ LAGOONS (blue water pools scattered across island) ═══
  const lagoons = [
    {x:15,y:14,w:5,h:4}, {x:85,y:12,w:4,h:3}, {x:20,y:50,w:5,h:4},
    {x:80,y:50,w:4,h:3}, {x:40,y:65,w:5,h:3}, {x:70,y:65,w:4,h:4},
    {x:95,y:25,w:3,h:3}, {x:10,y:35,w:4,h:3},
  ];
  for (const lag of lagoons) {
    for (let dy = 0; dy < lag.h; dy++) for (let dx = 0; dx < lag.w; dx++) {
      const ly = lag.y + dy, lx = lag.x + dx;
      if (ly >= 6 && ly < WORLD_H - 6 && lx >= 4 && lx < WORLD_W - 4) worldMap[ly][lx] = 3;
    }
    // Sand border around lagoon
    for (let dy = -1; dy <= lag.h; dy++) for (let dx = -1; dx <= lag.w; dx++) {
      const ly = lag.y + dy, lx = lag.x + dx;
      if (ly >= 6 && ly < WORLD_H - 6 && lx >= 4 && lx < WORLD_W - 4 && worldMap[ly][lx] === 17)
        worldMap[ly][lx] = 20;
    }
  }

  // ═══ PALM TREES — noise-based ═══
  for (let y = 6; y < WORLD_H - 6; y++) {
    for (let x = 4; x < WORLD_W - 4; x++) {
      const t = worldMap[y][x];
      if (t !== 20 && t !== 17) continue;
      const density = forestNoise(x, y, 55);
      if (density > 0.86) {
        worldMap[y][x] = 21;
      } else if (density > 0.80 && t === 20) {
        const edgeChance = (density - 0.80) / 0.06;
        if (_hash(x * 7, y * 11) / 0x7fffffff < edgeChance * 0.15) {
          worldMap[y][x] = 21;
        }
      }
    }
  }

  // ═══ OBSIDIAN FORMATIONS ═══
  const obsidianClusters = [
    {x:25,y:20}, {x:40,y:18}, {x:70,y:20}, {x:85,y:30},
    {x:30,y:45}, {x:60,y:50}, {x:75,y:45}, {x:15,y:60},
    {x:90,y:55}, {x:45,y:55}, {x:20,y:28}, {x:95,y:18},
  ];
  for (const oc of obsidianClusters) {
    if (oc.x >= 4 && oc.x < WORLD_W - 4 && oc.y >= 6 && oc.y < WORLD_H - 6) {
      if (worldMap[oc.y][oc.x] === 17) worldMap[oc.y][oc.x] = 16;
      if (oc.x+1 < WORLD_W-4 && worldMap[oc.y][oc.x+1] === 17) worldMap[oc.y][oc.x+1] = 16;
      if (oc.y+1 < WORLD_H-6 && worldMap[oc.y+1][oc.x] === 17) worldMap[oc.y+1][oc.x] = 16;
    }
  }

  // ═══ MAGMA CRYSTALS ═══
  for (let i = 0; i < 80; i++) {
    const mx = 6 + Math.floor(Math.random() * (WORLD_W - 12));
    const my = 8 + Math.floor(Math.random() * (WORLD_H - 16));
    if (worldMap[my][mx] === 17) worldMap[my][mx] = 18;
  }

  // ═══ PATHS ═══
  const hub = ZONE_HUBS.volcanic_isles;
  // West entrance to hub
  for (let x = 2; x < hub.x; x++) {
    worldMap[42][x] = 2; worldMap[43][x] = 2;
  }
  // Hub to volcano
  for (let x = hub.x + 7; x <= vcx - 6; x++) {
    worldMap[hub.y + 2][x] = 2; worldMap[hub.y + 3][x] = 2;
  }
  // Around volcano (ring road)
  for (let a = 0; a < 360; a += 3) {
    const rad = a * Math.PI / 180;
    const rx = Math.floor(vcx + Math.cos(rad) * 10);
    const ry = Math.floor(vcy + Math.sin(rad) * 8);
    if (rx >= 4 && rx < WORLD_W - 4 && ry >= 6 && ry < WORLD_H - 6 && worldMap[ry][rx] === 17)
      worldMap[ry][rx] = 2;
  }
  // Hub south to beach village
  for (let y = hub.y + 5; y < 62; y++) {
    const px = hub.x + 2 + Math.floor(Math.sin(y * 0.2) * 2);
    if (px >= 4 && px < WORLD_W - 4) { worldMap[y][px] = 2; worldMap[y][px+1] = 2; }
  }
  // East path to passage
  for (let x = vcx + 8; x < WORLD_W - 2; x++) {
    worldMap[42][x] = 2; worldMap[43][x] = 2;
  }

  // ═══ VOLCANIC HUB SETTLEMENT ═══
  const hubX = hub.x, hubY = hub.y;
  for (let y = hubY - 2; y < hubY + 7; y++) for (let x = hubX - 2; x < hubX + 9; x++) {
    if (x >= 4 && x < WORLD_W - 4 && y >= 6 && y < WORLD_H - 6)
      worldMap[y][x] = 20;
  }
  for (let y = hubY; y < hubY + 5; y++) for (let x = hubX; x < hubX + 7; x++)
    worldMap[y][x] = 2;
  // Buildings
  worldMap[hubY+1][hubX+1] = 5; worldMap[hubY+1][hubX+2] = 5; // forge
  worldMap[hubY+1][hubX+5] = 5; // outpost
  worldMap[hubY+3][hubX+1] = 5; worldMap[hubY+3][hubX+2] = 5; // tavern
  worldMap[hubY+3][hubX+5] = 5; // trading post
  // Framing palms
  const settlePalms = [
    {x:hubX-2,y:hubY-2},{x:hubX+8,y:hubY-2},{x:hubX-2,y:hubY+6},{x:hubX+8,y:hubY+6},
  ];
  for (const sp of settlePalms) {
    if (sp.x >= 4 && sp.x < WORLD_W-4 && sp.y >= 6 && sp.y < WORLD_H-6) worldMap[sp.y][sp.x] = 21;
  }

  // ═══ BEACH VILLAGE (south) ═══
  for (let y = 62; y < 68; y++) for (let x = 28; x < 36; x++) {
    if (y < WORLD_H - 6) worldMap[y][x] = 20;
  }
  for (let y = 63; y < 67; y++) for (let x = 29; x < 35; x++)
    worldMap[y][x] = 2;
  worldMap[64][30] = 5; worldMap[64][33] = 5;
  worldMap[66][31] = 5;
}

// ═══════════════════════════════════════════════════════════════
// DARK CASTLE — Full 110x85 map: dark stone, dead trees, castle structures
// ═══════════════════════════════════════════════════════════════
function _generateDarkCastle() {
  // Base: dark stone
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++)
      worldMap[y][x] = 22;

  // Border walls on 3 sides — west open for Volcanic Isles
  for (let x = 0; x < WORLD_W; x++) { worldMap[0][x] = 23; worldMap[1][x] = 23; }
  for (let x = 0; x < WORLD_W; x++) { worldMap[WORLD_H-1][x] = 23; worldMap[WORLD_H-2][x] = 23; }
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][WORLD_W-1] = 23; worldMap[y][WORLD_W-2] = 23; }

  // West border: dark wall with passage gap (from Volcanic Isles)
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][0] = 23; worldMap[y][1] = 23; }
  for (let y = 36; y <= 49; y++) { worldMap[y][0] = 24; worldMap[y][1] = 24; }

  const hub = ZONE_HUBS.dark_castle;

  // ═══ DEAD TREES — noise-based ═══
  for (let y = 3; y < WORLD_H - 3; y++) {
    for (let x = 3; x < WORLD_W - 3; x++) {
      if (worldMap[y][x] !== 22) continue;
      // Hub exclusion
      if (Math.abs(x - hub.x) < 8 && Math.abs(y - hub.y) < 8) continue;
      // Castle exclusion
      if (x >= 45 && x <= 75 && y >= 8 && y <= 25) continue;
      // Passage exclusion
      if (x <= 5 && y >= 33 && y <= 52) continue;

      const density = forestNoise(x, y, 131);
      if (density > 0.70) {
        worldMap[y][x] = 25;
      } else if (density > 0.62) {
        const edgeChance = (density - 0.62) / 0.08;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.3) {
          worldMap[y][x] = 25;
        }
      }
    }
  }

  // ═══ GRAND CASTLE (larger — central-north) ═══
  // Castle outer walls (20x14)
  for (let x = 48; x <= 72; x++) { worldMap[8][x] = 23; worldMap[22][x] = 23; }
  for (let y = 8; y <= 22; y++) { worldMap[y][48] = 23; worldMap[y][72] = 23; }
  // Castle interior
  for (let y = 9; y < 22; y++)
    for (let x = 49; x < 72; x++)
      worldMap[y][x] = 26;
  // Castle entrance (south wall gap)
  worldMap[22][59] = 26; worldMap[22][60] = 26; worldMap[22][61] = 26;
  // Throne room (center)
  for (let y = 12; y < 18; y++)
    for (let x = 56; x < 64; x++)
      worldMap[y][x] = 26;
  // Inner walls creating rooms
  for (let x = 49; x < 72; x++) { worldMap[11][x] = 23; worldMap[18][x] = 23; }
  // Doorways in inner walls
  worldMap[11][55] = 26; worldMap[11][60] = 26; worldMap[11][65] = 26;
  worldMap[18][55] = 26; worldMap[18][60] = 26; worldMap[18][65] = 26;

  // ═══ DARK PATHS ═══
  // West entrance to hub
  for (let x = 2; x < hub.x; x++) { worldMap[42][x] = 24; worldMap[43][x] = 24; }
  // Hub to castle
  for (let y = hub.y + 4; y > 22; y--) { worldMap[y][hub.x + 3] = 24; worldMap[y][hub.x + 4] = 24; }
  // Main east-west road
  for (let x = 4; x < WORLD_W - 4; x++) { worldMap[42][x] = 24; worldMap[43][x] = 24; }
  // North-south through castle
  for (let y = 4; y < WORLD_H - 4; y++) { worldMap[y][60] = 24; worldMap[y][61] = 24; }
  // Path to castle entrance
  for (let y = 22; y < 30; y++) { worldMap[y][59] = 24; worldMap[y][60] = 24; worldMap[y][61] = 24; }

  // ═══ SHADOW OUTPOST (near west entrance) ═══
  const hubX = hub.x, hubY = hub.y;
  for (let y = hubY - 1; y < hubY + 6; y++)
    for (let x = hubX - 2; x < hubX + 8; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 24;
  worldMap[hubY+1][hubX] = 5; worldMap[hubY+1][hubX+1] = 5; // shadow outpost
  worldMap[hubY+1][hubX+4] = 5; worldMap[hubY+1][hubX+5] = 5; // dark armory
  worldMap[hubY+3][hubX+1] = 5; // shadow market
  worldMap[hubY+3][hubX+3] = 5; // undercrypt entrance
  worldMap[hubY+3][hubX+5] = 12; // shadow tavern

  // ═══ SECONDARY: Crypt Ruins (southeast) ═══
  const crX = 80, crY = 55;
  for (let y = crY - 1; y < crY + 5; y++)
    for (let x = crX - 1; x < crX + 6; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 24;
  worldMap[crY+1][crX+1] = 5;
  worldMap[crY+1][crX+3] = 5;
  worldMap[crY+3][crX+2] = 27; // dungeon entrance

  // ═══ THIRD: Watchtower Camp (northwest) ═══
  const wtX = 15, wtY = 12;
  for (let y = wtY - 1; y < wtY + 4; y++)
    for (let x = wtX - 1; x < wtX + 5; x++)
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 24;
  worldMap[wtY+1][wtX+1] = 5;
  worldMap[wtY+1][wtX+3] = 5;

  // ═══ EERIE WATER POOLS (dark moats) ═══
  const pools = [
    {x:30,y:30,w:4,h:3}, {x:85,y:35,w:3,h:3}, {x:40,y:65,w:5,h:3},
    {x:15,y:50,w:4,h:3}, {x:90,y:15,w:3,h:3},
  ];
  for (const p of pools) {
    for (let dy = 0; dy < p.h; dy++)
      for (let dx = 0; dx < p.w; dx++) {
        const py = p.y + dy, px = p.x + dx;
        if (py >= 2 && py < WORLD_H - 2 && px >= 2 && px < WORLD_W - 2)
          worldMap[py][px] = 3;
      }
  }
}

// ═══════ TILE COLORS ═══════
const TILE_COLORS = {
  0: '#d8e8f0', // snow
  1: '#2a5a3a', // tree (frost)
  2: '#9a8a6a', // path
  3: '#2a4a8a', // water
  4: '#8ab8d8', // ice
  5: '#6a5a4a', // building
  6: '#3a3a5a', // encounter zone
  7: '#4a4a5a', // mountain
  8: '#5a4a3a', // workshop
  9: '#6aa84f', // grass (Rolling Hills)
  10: '#6aa84f', // flowers (Rolling Hills)
  11: '#7cb342', // rolling hill
  12: '#7a5a2a', // cantina
  13: '#3a6a2a', // warm tree (Rolling Hills)
  14: '#3a2020', // volcanic_rock
  15: '#cc4400', // lava
  16: '#1a1a2a', // obsidian
  17: '#4a4040', // ash_ground
  18: '#4a4040', // magma_crystal (base same as ash, detail drawn in render)
  19: '#c8b888', // plaza (warm tan/gold stone)
  20: '#e8d8a0', // sand (warm yellow beach)
  21: '#2a8a3a', // palm_tree (bright green)
  22: '#1a1020', // dark_stone (Dark Castle ground)
  23: '#0a0810', // dark_wall (impassable)
  24: '#2a2030', // dark_path (cobblestone)
  25: '#2a1a2a', // dark_tree (dead/twisted, impassable)
  26: '#3a2a3a', // castle_floor (grand interior)
  27: '#2a1a2a', // dungeons (dark stone entrance)
  28: '#aac8e8', // frost_dungeon (icy plaza beneath the dungeon sprite)
};
