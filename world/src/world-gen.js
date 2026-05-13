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
  { name: 'Magma Pools', x: 68, y: 10, w: 7, h: 5 },
  { name: 'Obsidian Fields', x: 78, y: 25, w: 8, h: 6 },
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
  const treePositions = [];
  for (let y = 3; y < 42; y++) {
    for (let x = 3; x < 56; x++) {
      if (worldMap[y][x] !== 0) continue;
      const density = forestNoise(x, y, 42);
      // Dense groves where noise > 0.55, sparse edges 0.45-0.55
      if (density > 0.55) {
        worldMap[y][x] = 1; treePositions.push({x, y});
      } else if (density > 0.45) {
        // Soft edge: scatter probability falls off
        const edgeChance = (density - 0.45) / 0.1;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.6) {
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

  // Mountain divider between Frost Valley and Rolling Hills (y: 43-44)
  for (let x = 0; x < WORLD_W; x++) { worldMap[43][x] = 7; worldMap[44][x] = 7; }

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

  // ═══ ROLLING HILLS ZONE (y: 45 to 68) ═══

  // First, open a passage through the southern border mountains (around x: 28-31, y: 43-44)
  for (let x = 28; x <= 31; x++) {
    worldMap[43][x] = 2; // path through mountain gap
    worldMap[44][x] = 2;
  }

  // Fill Rolling Hills base with grass
  for (let y = 45; y < 68; y++) {
    for (let x = 2; x < WORLD_W - 2; x++) {
      worldMap[y][x] = 9; // grass
    }
  }

  // Border mountains for new southern edge
  for (let x = 0; x < WORLD_W; x++) { worldMap[68][x] = 7; worldMap[69][x] = 7; }

  // Rolling hills terrain features
  // Scattered flower patches
  for (let i = 0; i < 40; i++) {
    const fx = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const fy = 46 + Math.floor(Math.random() * 20);
    if (fy < 68 && worldMap[fy][fx] === 9) worldMap[fy][fx] = 10;
  }

  // Rolling hill mounds
  for (let i = 0; i < 15; i++) {
    const hx = 5 + Math.floor(Math.random() * (WORLD_W - 10));
    const hy = 47 + Math.floor(Math.random() * 18);
    if (hy < 67 && worldMap[hy][hx] === 9) {
      worldMap[hy][hx] = 11;
      if (hx+1 < WORLD_W - 2 && worldMap[hy][hx+1] === 9) worldMap[hy][hx+1] = 11;
    }
  }

  // Warm trees — noise-based organic groves
  for (let y = 46; y < 68; y++) {
    for (let x = 3; x < WORLD_W - 3; x++) {
      if (worldMap[y][x] !== 9) continue;
      const density = forestNoise(x, y, 77); // different seed than frost
      if (density > 0.58) {
        worldMap[y][x] = 13;
      } else if (density > 0.48) {
        const edgeChance = (density - 0.48) / 0.1;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.5) {
          worldMap[y][x] = 13;
        }
      }
    }
  }

  // Path continuing south into Rolling Hills
  for (let y = 44; y < 65; y++) {
    const px = 29 + Math.floor(Math.sin(y * 0.25) * 2);
    if (worldMap[y][px] !== 7) worldMap[y][px] = 2;
    if (px+1 < WORLD_W && worldMap[y][px+1] !== 7) worldMap[y][px+1] = 2;
  }

  // More flower clusters in Rolling Hills
  for (let i = 0; i < 35; i++) {
    const fx = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const fy = 46 + Math.floor(Math.random() * 20);
    if (fy < 68 && worldMap[fy][fx] === 9) worldMap[fy][fx] = 10;
  }

  // Meadowbrook pond/lake (3x4 water tiles)
  for (let y = 50; y < 54; y++) for (let x = 45; x < 48; x++) {
    if (y < 68) worldMap[y][x] = 3;
  }
  // Ice edges around pond
  worldMap[49][45] = 4; worldMap[49][46] = 4; worldMap[49][47] = 4;
  worldMap[54][45] = 4; worldMap[54][46] = 4; worldMap[54][47] = 4;

  // Rolling Hills settlement — expanded "Meadowbrook" (5 buildings)
  const rhSettleX = 24, rhSettleY = 58;
  for (let y = rhSettleY - 1; y < rhSettleY + 5; y++) for (let x = rhSettleX - 2; x < rhSettleX + 7; x++) {
    if (y >= 45 && y < 68 && x >= 2 && x < WORLD_W - 2) worldMap[y][x] = 2;
  }
  worldMap[rhSettleY+1][rhSettleX+1] = 5; // inn
  worldMap[rhSettleY+1][rhSettleX+3] = 5; // seed shop
  worldMap[rhSettleY+1][rhSettleX-1] = 5; // meadow hall
  worldMap[rhSettleY+3][rhSettleX+1] = 5; // herbalist
  worldMap[rhSettleY+3][rhSettleX+3] = 5; // greenhouse

  // ═══ VOLCANIC ISLES — Tropical Paradise with Volcanoes (x: 62 to 88, y: 3 to 42) ═══

  // Mountain wall on east side of Frost Valley (x:58-61)
  for (let y = 2; y < 43; y++) {
    for (let x = 58; x < 62; x++) {
      if (x < WORLD_W) worldMap[y][x] = 7;
    }
  }

  // Fill Volcanic Isles with ash ground (interior land)
  for (let y = 3; y < 42; y++) {
    for (let x = 62; x < 88; x++) {
      if (x < WORLD_W - 2 && y < WORLD_H - 2) worldMap[y][x] = 17; // ash_ground
    }
  }

  // Blue ocean water around the edges — making these ISLANDS
  // Top water strip (y:3-5)
  for (let x = 62; x < 88; x++) {
    if (x < WORLD_W - 2) {
      worldMap[3][x] = 3; worldMap[4][x] = 3;
    }
  }
  // Bottom water strip (y:38-41)
  for (let x = 62; x < 88; x++) {
    if (x < WORLD_W - 2) {
      worldMap[38][x] = 3; worldMap[39][x] = 3;
      worldMap[40][x] = 3; worldMap[41][x] = 3;
    }
  }
  // Right water strip (x:85-87)
  for (let y = 3; y < 42; y++) {
    worldMap[y][85] = 3; worldMap[y][86] = 3;
    if (87 < WORLD_W - 2) worldMap[y][87] = 3;
  }
  // Left water (x:62-63) — partial, leave passage area dry
  for (let y = 3; y < 42; y++) {
    if (y < 19 || y > 23) { // leave passage clear
      worldMap[y][62] = 3; worldMap[y][63] = 3;
    }
  }

  // Sand beaches between water and land (1-2 tiles wide)
  // Top beach
  for (let x = 64; x < 85; x++) {
    if (x < WORLD_W - 2) {
      worldMap[5][x] = 20; worldMap[6][x] = 20;
    }
  }
  // Bottom beach
  for (let x = 64; x < 85; x++) {
    if (x < WORLD_W - 2) {
      worldMap[36][x] = 20; worldMap[37][x] = 20;
    }
  }
  // Right beach
  for (let y = 5; y < 38; y++) {
    worldMap[y][83] = 20; worldMap[y][84] = 20;
  }
  // Left beach (where no water passage)
  for (let y = 5; y < 19; y++) { worldMap[y][64] = 20; }
  for (let y = 24; y < 38; y++) { worldMap[y][64] = 20; }

  // Palm trees on beaches and near water
  const palmPositions = [
    {x:65,y:5},{x:67,y:6},{x:70,y:5},{x:73,y:6},{x:76,y:5},{x:79,y:6},{x:82,y:5},
    {x:65,y:37},{x:68,y:36},{x:71,y:37},{x:74,y:36},{x:77,y:37},{x:80,y:36},{x:83,y:37},
    {x:83,y:8},{x:84,y:12},{x:83,y:16},{x:84,y:20},{x:83,y:24},{x:84,y:28},{x:83,y:32},
    {x:64,y:8},{x:64,y:14},{x:64,y:26},{x:64,y:32},
    // Scattered interior palms
    {x:68,y:10},{x:72,y:12},{x:78,y:8},{x:80,y:18},{x:70,y:30},{x:76,y:34},
  ];
  for (const pp of palmPositions) {
    if (pp.x >= 64 && pp.x < 85 && pp.y >= 5 && pp.y < 38) {
      const t = worldMap[pp.y][pp.x];
      if (t === 17 || t === 20) worldMap[pp.y][pp.x] = 21;
    }
  }

  // Blue lagoons (3x3 water pools) scattered through islands
  const lagoons = [{x:69,y:12},{x:78,y:28},{x:73,y:32}];
  for (const lag of lagoons) {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const ly = lag.y + dy, lx = lag.x + dx;
      if (ly >= 5 && ly < 38 && lx >= 64 && lx < 85) worldMap[ly][lx] = 3;
    }
    // Sand around lagoons
    for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 3; dx++) {
      const ly = lag.y + dy, lx = lag.x + dx;
      if (ly >= 5 && ly < 38 && lx >= 64 && lx < 85 && worldMap[ly][lx] === 17) worldMap[ly][lx] = 20;
    }
  }

  // Mountain wall between Volcanic Isles and Dark Castle (x:88-90)
  for (let y = 0; y < WORLD_H; y++) {
    worldMap[y][88] = 7;
    worldMap[y][89] = 7;
    worldMap[y][90] = 7;
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
      if (density > 0.52) {
        dcTreePositions.push({x, y});
      } else if (density > 0.42) {
        const edgeChance = (density - 0.42) / 0.1;
        if (_hash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.5) {
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

  // Carve passage from Frost Valley into Volcanic Isles (y:20-22, x:58-63)
  for (let y = 20; y <= 22; y++) {
    for (let x = 58; x <= 65; x++) {
      worldMap[y][x] = 2; // path
    }
  }

  // Lava rivers — flowing THROUGH the tropical paradise (contrast!)
  // River 1: flows from top-left to bottom-right
  for (let i = 0; i < 25; i++) {
    const lx = 66 + Math.floor(Math.sin(i * 0.4) * 2) + Math.floor(i * 0.4);
    const ly = 8 + i;
    if (lx >= 65 && lx < 84 && ly >= 7 && ly < 36) {
      if (worldMap[ly][lx] !== 3) worldMap[ly][lx] = 15;
      if (lx+1 < 84 && worldMap[ly][lx+1] !== 3) worldMap[ly][lx+1] = 15;
    }
  }
  // River 2: horizontal lava flow
  for (let x = 70; x < 83; x++) {
    const ly = 22 + Math.floor(Math.sin(x * 0.5) * 2);
    if (ly >= 7 && ly < 36 && x < 84 && worldMap[ly][x] !== 3) { worldMap[ly][x] = 15; }
  }
  // River 3: short vertical flow
  for (let y = 28; y < 35; y++) {
    const lx = 74 + Math.floor(Math.sin(y * 0.6) * 2);
    if (lx >= 65 && lx < 84 && worldMap[y][lx] !== 3) { worldMap[y][lx] = 15; }
  }

  // Obsidian formations (dramatic dark crystals amid tropical greenery)
  const obsidianClusters = [
    {x:68, y:16}, {x:72, y:9}, {x:80, y:13}, {x:81, y:30}, {x:70, y:33},
    {x:76, y:18}, {x:80, y:20}, {x:69, y:26}, {x:77, y:34},
  ];
  for (const oc of obsidianClusters) {
    if (oc.x >= 65 && oc.x < 84 && oc.y >= 7 && oc.y < 36) {
      if (worldMap[oc.y][oc.x] !== 3) worldMap[oc.y][oc.x] = 16;
      if (oc.x+1 < 84 && worldMap[oc.y][oc.x+1] !== 3) worldMap[oc.y][oc.x+1] = 16;
      if (oc.y+1 < 36 && worldMap[oc.y+1][oc.x] !== 3) worldMap[oc.y+1][oc.x] = 16;
    }
  }

  // Magma crystal nodes scattered
  for (let i = 0; i < 25; i++) {
    const mx = 65 + Math.floor(Math.random() * 18);
    const my = 7 + Math.floor(Math.random() * 28);
    if (mx < 84 && my < 36 && worldMap[my][mx] === 17) worldMap[my][mx] = 18;
  }

  // Volcanic hub settlement — surrounded by palm trees and sand
  const vhX = 74, vhY = 14;
  for (let y = vhY - 1; y < vhY + 5; y++) for (let x = vhX - 1; x < vhX + 7; x++) {
    if (x >= 65 && x < 84 && y >= 7 && y < 36) {
      worldMap[y][x] = 20; // sand around settlement
    }
  }
  for (let y = vhY; y < vhY + 4; y++) for (let x = vhX; x < vhX + 6; x++) {
    if (x < 84 && y < 36) worldMap[y][x] = 2; // clear walkable area
  }
  // Palm trees framing the settlement
  const settlePalms = [{x:vhX-1,y:vhY-1},{x:vhX+6,y:vhY-1},{x:vhX-1,y:vhY+4},{x:vhX+6,y:vhY+4}];
  for (const sp of settlePalms) {
    if (sp.x >= 65 && sp.x < 84 && sp.y >= 7 && sp.y < 36) worldMap[sp.y][sp.x] = 21;
  }
  // Path to settlement
  for (let x = 65; x <= vhX; x++) { worldMap[vhY+1][x] = 2; worldMap[vhY+2][x] = 2; }
  // Buildings
  worldMap[vhY+1][vhX+1] = 5; worldMap[vhY+1][vhX+2] = 5; // forge
  worldMap[vhY+1][vhX+4] = 5; // outpost
  worldMap[vhY+3][vhX+2] = 5; // tavern

  // Encounter zones (all of them)
  for (const zone of ENCOUNTER_ZONES) {
    for (let y = zone.y; y < zone.y + zone.h && y < WORLD_H - 2; y++) {
      for (let x = zone.x; x < zone.x + zone.w && x < WORLD_W - 2; x++) {
        if (worldMap[y][x] === 0 || worldMap[y][x] === 9 || worldMap[y][x] === 17 || worldMap[y][x] === 20 || worldMap[y][x] === 22) worldMap[y][x] = 6;
      }
    }
  }

  // Clear trees from paths and buildings
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    if (worldMap[y][x] === 2 || worldMap[y][x] === 5 || worldMap[y][x] === 8 || worldMap[y][x] === 12 || worldMap[y][x] === 19 || worldMap[y][x] === 27) {
      // Clear adjacent trees for breathing room
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ny = y+dy, nx = x+dx;
        if (ny >= 0 && ny < WORLD_H && nx >= 0 && nx < WORLD_W && (worldMap[ny][nx] === 1 || worldMap[ny][nx] === 13)) worldMap[ny][nx] = (ny >= 45 ? 9 : 0);
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
