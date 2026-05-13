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

const ENCOUNTER_ZONES = [
  { name: 'Crystal Glade', x: 25, y: 12, w: 8, h: 6 },
  { name: 'Frozen Hollow', x: 8, y: 28, w: 7, h: 5 },
  { name: 'Aurora Fields', x: 40, y: 8, w: 7, h: 5 },
  { name: 'Shimmer Basin', x: 30, y: 32, w: 9, h: 5 },
  { name: 'Permafrost Depths', x: 48, y: 28, w: 6, h: 6 },
  { name: 'Sunlit Meadow', x: 12, y: 52, w: 8, h: 6 },
  { name: 'Bramble Thicket', x: 35, y: 55, w: 7, h: 5 },
  { name: 'Magma Pools', x: 68, y: 15, w: 7, h: 5 },
  { name: 'Obsidian Fields', x: 75, y: 40, w: 8, h: 6 },
  { name: 'Lava Shores', x: 62, y: 55, w: 7, h: 5 },
  { name: 'Ember Reef', x: 76, y: 60, w: 6, h: 5 },
  // Dark Castle
  { name: 'Shadow Realm', x: 93, y: 8, w: 7, h: 5 },
  { name: 'Throne Approach', x: 100, y: 28, w: 6, h: 6 },
];
// 0=snow, 1=tree, 2=path, 3=water, 4=ice, 5=building, 6=encounter_zone, 7=mountain, 8=craft_building, 9=grass, 10=flowers, 11=rolling_hill, 12=cantina, 13=warm_tree, 19=plaza, 20=sand, 21=palm_tree
// 22=dark_stone, 23=dark_wall, 24=dark_path, 25=dark_tree, 26=castle_floor, 27=dungeons
let worldMap = [];

function generateWorld() {
  worldMap = [];
  for (let y = 0; y < WORLD_H; y++) {
    worldMap[y] = [];
    for (let x = 0; x < WORLD_W; x++) {
      worldMap[y][x] = 0; // snow
    }
  }

  // Border mountains
  for (let x = 0; x < WORLD_W; x++) { worldMap[0][x] = 7; worldMap[1][x] = 7; worldMap[WORLD_H-1][x] = 7; worldMap[WORLD_H-2][x] = 7; }
  for (let y = 0; y < WORLD_H; y++) { worldMap[y][0] = 7; worldMap[y][1] = 7; worldMap[y][WORLD_W-1] = 7; worldMap[y][WORLD_W-2] = 7; }

  // Water (frozen lake)
  for (let y = 18; y < 24; y++) for (let x = 35; x < 45; x++) worldMap[y][x] = 4; // ice
  for (let y = 19; y < 23; y++) for (let x = 36; x < 44; x++) worldMap[y][x] = 3; // water center

  // Frost Valley trees — noise-based organic forests
  // Sparse scattered pine groves with open snowy meadows between them
  const treePositions = [];
  for (let y = 3; y < 42; y++) {
    for (let x = 3; x < 53; x++) {
      if (worldMap[y][x] !== 0) continue;
      // Hub area exclusion — keep Polaris town completely open
      if (x >= 12 && x <= 28 && y >= 16 && y <= 32) continue;
      // Frozen lake exclusion — let the lake and its shores be visible
      if (x >= 33 && x <= 46 && y >= 16 && y <= 25) continue;
      // Keep south road corridor clear — diagonal from hub (x~17) to passage (x~29)
      // Width of 4 tiles on each side of the road center
      const roadCenterX = 17 + ((y - 31) / 12) * 12;
      if (y >= 28 && Math.abs(x - roadCenterX) < 5) continue;
      // Also keep zone passage wide near border
      if (y >= 38 && x >= 24 && x <= 35) continue;
      const density = forestNoise(x, y, 42);
      // Thinned out — open explorable valley with small pine clusters
      if (density > 0.82) {
        worldMap[y][x] = 1; treePositions.push({x, y});
      } else if (density > 0.74) {
        // Soft edge: very sparse scatter
        const edgeChance = (density - 0.74) / 0.08;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.2) {
          worldMap[y][x] = 1; treePositions.push({x, y});
        }
      }
    }
  }

  // Main path (horizontal through center)
  for (let x = 2; x < WORLD_W - 2; x++) {
    const py = 22 + Math.floor(Math.sin(x * 0.3) * 2);
    if (py >= 2 && py < WORLD_H - 2) { worldMap[py][x] = 2; if (py+1 < WORLD_H-2) worldMap[py+1][x] = 2; }
  }
  // Vertical path to hub
  for (let y = 8; y < 25; y++) { worldMap[y][15] = 2; worldMap[y][16] = 2; }

  // ═══ POLARIS HUB TOWN (expanded 10x10 area) ═══
  const hubX = HUB.x, hubY = HUB.y;
  // Clear a large area for Polaris (10 wide, 10 tall, centered roughly on hub)
  const polarisX = hubX - 1, polarisY = hubY - 1;
  for (let y = polarisY; y < polarisY + 10; y++) {
    for (let x = polarisX; x < polarisX + 10; x++) {
      if (y >= 2 && y < WORLD_H - 2 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2; // path around hub
    }
  }
  // Central plaza (4x4 warm tan stone in the middle)
  const plazaCX = hubX + 2, plazaCY = hubY + 2;
  for (let y = plazaCY; y < plazaCY + 4; y++) {
    for (let x = plazaCX; x < plazaCX + 4; x++) {
      worldMap[y][x] = 19; // plaza tile
    }
  }
  // Decorative path border around plaza
  for (let x = plazaCX - 1; x <= plazaCX + 4; x++) {
    if (x >= 2 && x < WORLD_W - 2) {
      worldMap[plazaCY - 1][x] = 2;
      worldMap[plazaCY + 4][x] = 2;
    }
  }
  for (let y = plazaCY; y < plazaCY + 4; y++) {
    worldMap[y][plazaCX - 1] = 2;
    worldMap[y][plazaCX + 4] = 2;
  }
  // Buildings arranged around the plaza
  worldMap[hubY+1][hubX+1] = 5; worldMap[hubY+1][hubX+2] = 5; // trading post
  worldMap[hubY+1][hubX+5] = 5; worldMap[hubY+1][hubX+6] = 5; // arena
  worldMap[hubY+3][hubX+1] = 8; worldMap[hubY+3][hubX+2] = 8; // workshop
  worldMap[hubY+3][hubX+5] = 5; worldMap[hubY+3][hubX+6] = 5; // inn
  // Wider path approaches to Polaris
  for (let y = polarisY - 2; y < polarisY; y++) {
    for (let x = hubX + 1; x < hubX + 5; x++) {
      if (y >= 2) worldMap[y][x] = 2;
    }
  }
  for (let y = polarisY + 10; y < polarisY + 12; y++) {
    for (let x = hubX + 1; x < hubX + 5; x++) {
      if (y < WORLD_H - 2) worldMap[y][x] = 2;
    }
  }

  // ── South road from Polaris Hub to Rolling Hills passage ──
  // Carve a clear 2-wide path from hub south exit (x:16-19, y:31) down to mountain gap (x:28-31, y:43)
  for (let y = 31; y <= 43; y++) {
    // Gradual diagonal from hub (x~17) to passage (x~29)
    const progress = (y - 31) / 12; // 0 to 1
    const px = Math.floor(17 + progress * 12); // x: 17 → 29
    for (let dx = -1; dx <= 2; dx++) {
      const tx = px + dx;
      if (tx >= 2 && tx < WORLD_W - 2) {
        if (worldMap[y][tx] === 0 || worldMap[y][tx] === 1) worldMap[y][tx] = 2;
      }
    }
  }

  // Mountain divider between Frost Valley and Rolling Hills (y: 43-44)
  // Only runs west half (x:0-55) — east of x:55 is Volcanic Isles continuing south
  for (let x = 0; x <= 55; x++) { worldMap[43][x] = 7; worldMap[44][x] = 7; }

  // Cantina/Frozen Mug building (hub area)
  worldMap[hubY+5][hubX+3] = 12; worldMap[hubY+5][hubX+4] = 12;
  // Clear path to cantina
  worldMap[hubY+4][hubX+3] = 2; worldMap[hubY+4][hubX+4] = 2;
  worldMap[hubY+5][hubX+2] = 2; worldMap[hubY+5][hubX+5] = 2;

  // Dungeons entrance (south of cantina)
  worldMap[hubY+7][hubX+3] = 27; worldMap[hubY+7][hubX+4] = 27;
  // Clear path to dungeons
  worldMap[hubY+6][hubX+3] = 2; worldMap[hubY+6][hubX+4] = 2;
  worldMap[hubY+7][hubX+2] = 2; worldMap[hubY+7][hubX+5] = 2;

  // ═══ FROST VALLEY — Enhanced ice and tree clusters ═══
  // More ice tiles around frozen lake
  for (let y = 17; y < 25; y++) for (let x = 34; x < 46; x++) {
    if (worldMap[y][x] === 0) worldMap[y][x] = 4;
  }
  // (Tree clusters now handled by noise-based forest generation above)
  // More path connections between zones
  // Path from frozen lake to Crystal Glade
  for (let x = 25; x < 36; x++) { if (worldMap[18][x] === 0) worldMap[18][x] = 2; }
  // Path from hub south
  for (let y = 12; y < 22; y++) { if (worldMap[y][20] === 0) worldMap[y][20] = 2; }

  // ═══ ROLLING HILLS ZONE (y: 45 to 75, x: 2 to 54 — west half only) ═══

  // First, open a passage through the southern border mountains (around x: 28-31, y: 43-44)
  for (let x = 28; x <= 31; x++) {
    worldMap[43][x] = 2; // path through mountain gap
    worldMap[44][x] = 2;
  }

  // Fill Rolling Hills base with grass (WEST HALF ONLY — east is Volcanic Isles)
  for (let y = 45; y < 76; y++) {
    for (let x = 2; x < 55; x++) {
      worldMap[y][x] = 9; // grass
    }
  }

  // Border mountains for Rolling Hills southern edge (west half only)
  for (let x = 0; x <= 55; x++) { worldMap[76][x] = 7; worldMap[77][x] = 7; }

  // Rolling hills terrain features
  // Scattered flower patches
  for (let i = 0; i < 50; i++) {
    const fx = 4 + Math.floor(Math.random() * 48); // x:4-51
    const fy = 46 + Math.floor(Math.random() * 28);
    if (fy < 76 && fx < 54 && worldMap[fy][fx] === 9) worldMap[fy][fx] = 10;
  }

  // Rolling hill mounds
  for (let i = 0; i < 18; i++) {
    const hx = 5 + Math.floor(Math.random() * 45); // x:5-49
    const hy = 47 + Math.floor(Math.random() * 26);
    if (hy < 75 && hx < 53 && worldMap[hy][hx] === 9) {
      worldMap[hy][hx] = 11;
      if (hx+1 < 54 && worldMap[hy][hx+1] === 9) worldMap[hy][hx+1] = 11;
    }
  }

  // Warm trees — noise-based organic groves (start y=49 to keep zone entrance clear)
  for (let y = 49; y < 76; y++) {
    for (let x = 3; x < 54; x++) {
      if (worldMap[y][x] !== 9) continue;
      // Skip near the passage (x: 26-33) to keep zone entrance open
      if (y < 52 && x >= 26 && x <= 33) continue;
      const density = forestNoise(x, y, 77); // different seed than frost
      // Thinned — open meadows with scattered groves
      if (density > 0.78) {
        worldMap[y][x] = 13;
      } else if (density > 0.70) {
        const edgeChance = (density - 0.70) / 0.08;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.25) {
          worldMap[y][x] = 13;
        }
      }
    }
  }

  // Path continuing south into Rolling Hills
  for (let y = 44; y < 72; y++) {
    const px = 29 + Math.floor(Math.sin(y * 0.25) * 2);
    if (px < 54 && worldMap[y][px] !== 7) worldMap[y][px] = 2;
    if (px+1 < 54 && worldMap[y][px+1] !== 7) worldMap[y][px+1] = 2;
  }

  // More flower clusters in Rolling Hills
  for (let i = 0; i < 40; i++) {
    const fx = 4 + Math.floor(Math.random() * 48);
    const fy = 46 + Math.floor(Math.random() * 28);
    if (fy < 76 && fx < 54 && worldMap[fy][fx] === 9) worldMap[fy][fx] = 10;
  }

  // Meadowbrook pond/lake (3x4 water tiles)
  for (let y = 50; y < 54; y++) for (let x = 42; x < 45; x++) {
    if (y < 76) worldMap[y][x] = 3;
  }
  // Ice edges around pond
  worldMap[49][42] = 4; worldMap[49][43] = 4; worldMap[49][44] = 4;
  worldMap[54][42] = 4; worldMap[54][43] = 4; worldMap[54][44] = 4;

  // Rolling Hills settlement — expanded "Meadowbrook" (5 buildings)
  const rhSettleX = 24, rhSettleY = 58;
  for (let y = rhSettleY - 1; y < rhSettleY + 5; y++) for (let x = rhSettleX - 2; x < rhSettleX + 7; x++) {
    if (y >= 45 && y < 76 && x >= 2 && x < 54) worldMap[y][x] = 2;
  }
  worldMap[rhSettleY+1][rhSettleX+1] = 5; // inn
  worldMap[rhSettleY+1][rhSettleX+3] = 5; // seed shop
  worldMap[rhSettleY+1][rhSettleX-1] = 5; // meadow hall
  worldMap[rhSettleY+3][rhSettleX+1] = 5; // herbalist
  worldMap[rhSettleY+3][rhSettleX+3] = 5; // greenhouse

  // ═══ VOLCANIC ISLES — HUGE Tropical Island (x: 56 to 87, y: 3 to 75) ═══

  // Mountain wall on west side of Volcanic Isles (x:53-55) — borders Frost Valley north, Rolling Hills south
  for (let y = 2; y < 76; y++) {
    for (let x = 53; x <= 55; x++) {
      if (x < WORLD_W) worldMap[y][x] = 7;
    }
  }

  // Fill Volcanic Isles with ash ground (big rectangular interior)
  for (let y = 3; y < 75; y++) {
    for (let x = 56; x < 88; x++) {
      if (x < WORLD_W - 2 && y < WORLD_H - 2) worldMap[y][x] = 17; // ash_ground
    }
  }

  // ── Ocean water border (2-3 tiles wide on all edges) ──
  // Top water strip (y:3-4) — thinner, more land
  for (let x = 56; x < 88; x++) {
    worldMap[3][x] = 3; worldMap[4][x] = 3;
  }
  // Bottom water strip (y:73-74) — thinner
  for (let x = 56; x < 88; x++) {
    worldMap[73][x] = 3; worldMap[74][x] = 3;
  }
  // Right water strip (x:86-87) — thinner, more land to explore
  for (let y = 3; y < 75; y++) {
    worldMap[y][86] = 3; worldMap[y][87] = 3;
  }
  // Left water (x:56-57) — partial, leave passage area at y:19-23 dry
  for (let y = 3; y < 75; y++) {
    if (y < 19 || y > 23) {
      worldMap[y][56] = 3; worldMap[y][57] = 3;
    }
  }

  // ── Sand beaches (2 tiles wide between water and land) ──
  // Top beach (y:6-7)
  for (let x = 58; x < 85; x++) { worldMap[6][x] = 20; worldMap[7][x] = 20; }
  // Bottom beach (y:70-71)
  for (let x = 58; x < 85; x++) { worldMap[70][x] = 20; worldMap[71][x] = 20; }
  // Right beach (x:83-84)
  for (let y = 6; y < 71; y++) { worldMap[y][83] = 20; worldMap[y][84] = 20; }
  // Left beach (x:58-59, skip passage at y:19-23)
  for (let y = 6; y < 19; y++) { worldMap[y][58] = 20; worldMap[y][59] = 20; }
  for (let y = 24; y < 71; y++) { worldMap[y][58] = 20; worldMap[y][59] = 20; }

  // ── VOLCANO LANDMARK — 5x5 lava core at center (~x:72, y:30) ──
  // Outer volcanic_rock ring (7x7)
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const vx = 72 + dx, vy = 30 + dy;
    if (vx >= 60 && vx < 84 && vy >= 8 && vy < 70) worldMap[vy][vx] = 14; // volcanic_rock
  }
  // Obsidian ring (6x6 inside)
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const vx = 72 + dx, vy = 30 + dy;
    worldMap[vy][vx] = 16; // obsidian
  }
  // Lava core (3x3 center)
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    worldMap[30 + dy][72 + dx] = 15; // lava
  }
  // Extra lava at dead center
  worldMap[30][72] = 15;

  // ── Lava rivers flowing FROM the volcano in 4 directions ──
  // River NORTH: volcano (y:27) up to y:10
  for (let y = 10; y < 27; y++) {
    const lx = 72 + Math.floor(Math.sin(y * 0.5) * 2);
    if (lx >= 60 && lx < 84) { worldMap[y][lx] = 15; if (lx+1 < 84) worldMap[y][lx+1] = 15; }
  }
  // River SOUTH: volcano (y:33) down to y:60
  for (let y = 33; y < 60; y++) {
    const lx = 72 + Math.floor(Math.sin(y * 0.4) * 2);
    if (lx >= 60 && lx < 84) { worldMap[y][lx] = 15; }
  }
  // River EAST: volcano (x:75) right to x:82
  for (let x = 75; x < 82; x++) {
    const ly = 30 + Math.floor(Math.sin(x * 0.6) * 2);
    if (ly >= 8 && ly < 70) { worldMap[ly][x] = 15; }
  }
  // River WEST: volcano (x:69) left to x:61
  for (let x = 61; x < 69; x++) {
    const ly = 30 + Math.floor(Math.sin(x * 0.5) * 2);
    if (ly >= 8 && ly < 70) { worldMap[ly][x] = 15; }
  }

  // ── Blue lagoons (6 scattered through the island, 3x3 to 5x5) ──
  const lagoons = [
    {x:64,y:14,w:4,h:4}, {x:78,y:12,w:3,h:3}, {x:66,y:45,w:5,h:4},
    {x:79,y:50,w:3,h:3}, {x:62,y:62,w:4,h:3}, {x:76,y:64,w:4,h:4},
  ];
  for (const lag of lagoons) {
    // Water fill
    for (let dy = 0; dy < lag.h; dy++) for (let dx = 0; dx < lag.w; dx++) {
      const ly = lag.y + dy, lx = lag.x + dx;
      if (ly >= 8 && ly < 70 && lx >= 60 && lx < 84) worldMap[ly][lx] = 3;
    }
    // Sand border around lagoon
    for (let dy = -1; dy <= lag.h; dy++) for (let dx = -1; dx <= lag.w; dx++) {
      const ly = lag.y + dy, lx = lag.x + dx;
      if (ly >= 8 && ly < 70 && lx >= 60 && lx < 84 && worldMap[ly][lx] === 17) worldMap[ly][lx] = 20;
    }
  }

  // ── Palm trees — noise-based organic groves along beaches and near lagoons ──
  for (let y = 6; y < 71; y++) {
    for (let x = 58; x < 84; x++) {
      const t = worldMap[y][x];
      if (t !== 20 && t !== 17) continue; // only on sand or ash
      const density = forestNoise(x, y, 55); // unique seed for volcanic palms
      // Very sparse palms — mostly open sandy terrain
      if (density > 0.88) {
        worldMap[y][x] = 21; // palm_tree
      } else if (density > 0.82 && t === 20) {
        const edgeChance = (density - 0.82) / 0.06;
        if (_hash(x * 7, y * 11) / 0x7fffffff < edgeChance * 0.15) {
          worldMap[y][x] = 21;
        }
      }
    }
  }

  // Mountain wall between Volcanic Isles and Dark Castle (x:88-90)
  // Full height — separates volcanic ocean from dark castle region
  for (let y = 0; y < WORLD_H; y++) {
    worldMap[y][88] = 7;
    worldMap[y][89] = 7;
    worldMap[y][90] = 7;
  }

  // ── Obsidian formations scattered across the big island ──
  const obsidianClusters = [
    {x:68,y:16}, {x:72,y:9}, {x:80,y:13}, {x:81,y:30}, {x:70,y:40},
    {x:76,y:18}, {x:80,y:22}, {x:69,y:50}, {x:77,y:55}, {x:64,y:35},
    {x:75,y:42}, {x:82,y:60}, {x:66,y:58}, {x:71,y:65}, {x:78,y:38},
  ];
  for (const oc of obsidianClusters) {
    if (oc.x >= 60 && oc.x < 84 && oc.y >= 8 && oc.y < 70) {
      if (worldMap[oc.y][oc.x] === 17) worldMap[oc.y][oc.x] = 16;
      if (oc.x+1 < 84 && worldMap[oc.y][oc.x+1] === 17) worldMap[oc.y][oc.x+1] = 16;
      if (oc.y+1 < 70 && worldMap[oc.y+1][oc.x] === 17) worldMap[oc.y+1][oc.x] = 16;
    }
  }

  // ── Magma crystal nodes scattered across island ──
  for (let i = 0; i < 45; i++) {
    const mx = 60 + Math.floor(Math.random() * 23);
    const my = 8 + Math.floor(Math.random() * 60);
    if (mx < 84 && my < 70 && worldMap[my][mx] === 17) worldMap[my][mx] = 18;
  }

  // ═══════ DARK CASTLE REGION (x:90-108, y:2-40) ═══════

  // Fill interior with dark_stone
  for (let y = 2; y < 40; y++) {
    for (let x = 91; x < 108; x++) {
      worldMap[y][x] = 22; // dark_stone
    }
  }

  // Border dark_wall around edges
  for (let x = 91; x < 108; x++) { worldMap[2][x] = 23; worldMap[39][x] = 23; }
  for (let y = 2; y < 40; y++) { worldMap[y][107] = 23; }

  // Passage from Volcanic Isles into Dark Castle (y:18-22)
  for (let y = 18; y <= 22; y++) {
    worldMap[y][88] = 24; worldMap[y][89] = 24; worldMap[y][90] = 24; worldMap[y][91] = 24;
  }

  // Dark cobblestone paths from passage to castle and around
  // Main east-west path from passage to castle
  for (let x = 91; x <= 104; x++) { worldMap[20][x] = 24; worldMap[21][x] = 24; }
  // North-south path to castle entrance
  for (let y = 12; y <= 21; y++) { worldMap[y][100] = 24; worldMap[y][101] = 24; }
  // Path south from main path
  for (let y = 21; y <= 35; y++) { worldMap[y][100] = 24; worldMap[y][101] = 24; }

  // Dead/twisted trees — noise-based dark groves
  const dcTreePositions = [];
  for (let y = 3; y < 39; y++) {
    for (let x = 92; x < 107; x++) {
      if (worldMap[y][x] !== 22) continue;
      const density = forestNoise(x, y, 131); // unique seed
      // Thinned — eerie scattered dead trees, not a wall
      if (density > 0.72) {
        dcTreePositions.push({x, y});
      } else if (density > 0.64) {
        const edgeChance = (density - 0.64) / 0.08;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.3) {
          dcTreePositions.push({x, y});
        }
      }
    }
  }
  for (const tp of dcTreePositions) { worldMap[tp.y][tp.x] = 25; }

  // Grand castle structure at (96, 8) — 12x10 area
  // Castle walls (dark_wall)
  for (let x = 96; x <= 107; x++) { worldMap[8][x] = 23; worldMap[17][x] = 23; }
  for (let y = 8; y <= 17; y++) { worldMap[y][96] = 23; worldMap[y][107] = 23; }
  // Castle interior (castle_floor)
  for (let y = 9; y < 17; y++) {
    for (let x = 97; x < 107; x++) {
      worldMap[y][x] = 26;
    }
  }
  // Castle entrance — 2-tile gap in south wall
  worldMap[17][100] = 26; worldMap[17][101] = 26;

  // Small settlement/outpost near passage (92, 19)
  for (let y = 18; y < 24; y++) for (let x = 92; x < 96; x++) {
    if (worldMap[y][x] === 22 || worldMap[y][x] === 25) worldMap[y][x] = 22;
  }
  // Outpost buildings
  worldMap[19][92] = 5; worldMap[19][93] = 5; // Shadow Outpost
  worldMap[19][94] = 5; worldMap[19][95] = 5; // Dark Armory
  // Paths around outpost
  for (let x = 92; x <= 95; x++) { worldMap[20][x] = 24; worldMap[21][x] = 24; }

  // East border mountains (far right)
  for (let y = 0; y < WORLD_H; y++) {
    worldMap[y][108] = 7; worldMap[y][109] = 7;
  }

  // Carve passage from Frost Valley into Volcanic Isles (y:20-22, x:53-59)
  for (let y = 20; y <= 22; y++) {
    for (let x = 53; x <= 59; x++) {
      worldMap[y][x] = 2; // path through mountain wall
    }
  }

  // ── Volcanic Hub Settlement (x:68, y:28 area — centered on island) ──
  const vhX = 66, vhY = 26;
  // Clear a generous area for the hub (8x8 sand pad)
  for (let y = vhY - 2; y < vhY + 7; y++) for (let x = vhX - 2; x < vhX + 9; x++) {
    if (x >= 60 && x < 84 && y >= 8 && y < 70) {
      worldMap[y][x] = 20; // sand around settlement
    }
  }
  // Walkable center (6x5)
  for (let y = vhY; y < vhY + 5; y++) for (let x = vhX; x < vhX + 7; x++) {
    if (x < 84 && y < 70) worldMap[y][x] = 2;
  }
  // Palm trees framing the settlement
  const settlePalms = [
    {x:vhX-2,y:vhY-2},{x:vhX+8,y:vhY-2},{x:vhX-2,y:vhY+6},{x:vhX+8,y:vhY+6},
    {x:vhX+3,y:vhY-2},{x:vhX-2,y:vhY+2},{x:vhX+8,y:vhY+2},
  ];
  for (const sp of settlePalms) {
    if (sp.x >= 60 && sp.x < 84 && sp.y >= 8 && sp.y < 70) worldMap[sp.y][sp.x] = 21;
  }
  // Path from west passage to settlement
  for (let x = 59; x <= vhX; x++) { worldMap[vhY+1][x] = 2; worldMap[vhY+2][x] = 2; }
  // Path from settlement east toward volcano
  for (let x = vhX + 7; x <= 75; x++) { worldMap[vhY+2][x] = 2; worldMap[vhY+3][x] = 2; }
  // Path south from settlement to lower island
  for (let y = vhY + 5; y < 60; y++) {
    const px = 68 + Math.floor(Math.sin(y * 0.2) * 2);
    if (px >= 60 && px < 84) { worldMap[y][px] = 2; worldMap[y][px+1] = 2; }
  }
  // Buildings around hub
  worldMap[vhY+1][vhX+1] = 5; worldMap[vhY+1][vhX+2] = 5; // forge
  worldMap[vhY+1][vhX+5] = 5; // outpost
  worldMap[vhY+3][vhX+1] = 5; worldMap[vhY+3][vhX+2] = 5; // tavern
  worldMap[vhY+3][vhX+5] = 5; // trading post

  // ── Southern beach village (x:70, y:62) — second settlement ──
  for (let y = 60; y < 66; y++) for (let x = 68; x < 76; x++) {
    if (x >= 60 && x < 84 && y < 70) worldMap[y][x] = 20; // sand pad
  }
  for (let y = 61; y < 65; y++) for (let x = 69; x < 75; x++) {
    worldMap[y][x] = 2; // walkable
  }
  worldMap[62][70] = 5; worldMap[62][73] = 5; // beach huts
  worldMap[64][71] = 5; // dock house

  // Encounter zones — no longer painted as different-colored floors.
  // NPCs already wander the world; these micro-areas aren't needed visually.
  // Zone data still exists in ENCOUNTER_ZONES for world boss spawning logic.

  // Clear trees from paths and buildings
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    if (worldMap[y][x] === 2 || worldMap[y][x] === 5 || worldMap[y][x] === 8 || worldMap[y][x] === 12 || worldMap[y][x] === 19 || worldMap[y][x] === 27) {
      // Clear adjacent trees for breathing room (frost, warm, palm, dark)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ny = y+dy, nx = x+dx;
        if (ny >= 0 && ny < WORLD_H && nx >= 0 && nx < WORLD_W) {
          const t = worldMap[ny][nx];
          if (t === 1 || t === 13) worldMap[ny][nx] = (ny >= 45 && nx < 55 ? 9 : 0);
          if (t === 21) worldMap[ny][nx] = 17; // palm -> ash_ground
        }
      }
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
};
