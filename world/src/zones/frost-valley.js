// ═══════════════════════════════════════════════════════════════════════════
// FROST VALLEY — Full Zone Generator (110x85)
// Fills the entire map with rich Frost Valley content:
//   Polaris hub, Frosty Woods, Frozen Lake District, The Mountain,
//   Ice Dungeon, Logging Camp, Aurora Fields, Frozen Waterfall,
//   Crystal Caverns entrance, Hidden Mystery
// ═══════════════════════════════════════════════════════════════════════════

// ── Noise helpers (same algorithm as world-gen.js) ──
function _fvHash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

function _fvNoise2d(x, y, freq) {
  const fx = x * freq, fy = y * freq;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const dx = fx - ix, dy = fy - iy;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const n00 = _fvHash(ix, iy) / 0x7fffffff;
  const n10 = _fvHash(ix + 1, iy) / 0x7fffffff;
  const n01 = _fvHash(ix, iy + 1) / 0x7fffffff;
  const n11 = _fvHash(ix + 1, iy + 1) / 0x7fffffff;
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

function fvForestNoise(x, y, seed) {
  const s = seed || 0;
  const n1 = _fvNoise2d(x + s, y + s, 0.12);
  const n2 = _fvNoise2d(x + s + 100, y + s + 100, 0.25) * 0.4;
  const n3 = _fvNoise2d(x + s + 200, y + s + 200, 0.5) * 0.15;
  return Math.min(1, Math.max(0, n1 + n2 + n3));
}

// Higher-frequency noise for terrain variation (lakes, tundra patches)
function fvTerrainNoise(x, y, seed) {
  const s = seed || 0;
  const n1 = _fvNoise2d(x + s, y + s, 0.08);
  const n2 = _fvNoise2d(x + s + 50, y + s + 50, 0.18) * 0.5;
  return Math.min(1, Math.max(0, n1 + n2));
}

// ── Tile codes (matching world-gen.js) ──
const T = {
  SNOW: 0, TREE: 1, PATH: 2, WATER: 3, ICE: 4,
  BUILDING: 5, ENCOUNTER: 6, MOUNTAIN: 7, WORKSHOP: 8,
  PLAZA: 19, CANTINA: 12, DUNGEON: 27, FROST_DUNGEON: 28,
};

// ═══════════════════════════════════════════════════════════════════════════
// Main generator — fills the ENTIRE 110x85 worldMap with Frost Valley
// ═══════════════════════════════════════════════════════════════════════════
function generateFrostValley(worldMap, W, H) {
  // ── 1. Base layer: all snow ──
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      worldMap[y][x] = T.SNOW;
    }
  }

  // ── 2. Border mountains (2 tiles thick on all edges) ──
  for (let x = 0; x < W; x++) {
    worldMap[0][x] = T.MOUNTAIN; worldMap[1][x] = T.MOUNTAIN;
    worldMap[H - 1][x] = T.MOUNTAIN; worldMap[H - 2][x] = T.MOUNTAIN;
  }
  for (let y = 0; y < H; y++) {
    worldMap[y][0] = T.MOUNTAIN; worldMap[y][1] = T.MOUNTAIN;
    worldMap[y][W - 1] = T.MOUNTAIN; worldMap[y][W - 2] = T.MOUNTAIN;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THE MOUNTAIN — tall range along the north edge (y: 2-14)
  // With cave entrances, cliffside paths, Crystal Caverns
  // ═══════════════════════════════════════════════════════════════════════
  for (let y = 2; y <= 12; y++) {
    for (let x = 2; x < W - 2; x++) {
      // Irregular southern edge using noise
      const edgeNoise = fvTerrainNoise(x, y, 300);
      const maxY = 10 + Math.floor(edgeNoise * 4); // mountains extend 10-14 rows
      if (y <= maxY) {
        worldMap[y][x] = T.MOUNTAIN;
      }
    }
  }
  // Extra mountain depth in corners and edges for natural look
  for (let y = 2; y <= 14; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (worldMap[y][x] === T.MOUNTAIN) continue;
      const edgeNoise = fvTerrainNoise(x, y, 305);
      if (edgeNoise > 0.7 && y <= 14) {
        worldMap[y][x] = T.MOUNTAIN;
      }
    }
  }

  // ── Crystal Caverns entrance (cave mouth in the mountain, x:30-34, y:12-14) ──
  const cavernX = 32, cavernY = 13;
  // Carve a 5x3 cave opening
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cx = cavernX + dx, cy = cavernY + dy;
      if (cy >= 2 && cy < H - 2 && cx >= 2 && cx < W - 2) {
        worldMap[cy][cx] = T.FROST_DUNGEON;
      }
    }
  }
  // Path leading south from caverns
  for (let y = cavernY + 2; y <= cavernY + 6; y++) {
    worldMap[y][cavernX] = T.PATH;
    worldMap[y][cavernX + 1] = T.PATH;
  }

  // ── Cliffside path winding through the mountain (east-west) ──
  for (let x = 8; x < 95; x++) {
    const py = 8 + Math.floor(Math.sin(x * 0.15) * 2);
    if (py >= 2 && py < H - 2 && worldMap[py][x] === T.MOUNTAIN) {
      worldMap[py][x] = T.PATH;
    }
  }

  // ── Cave entrances scattered in the mountain ──
  const caveEntrances = [
    { x: 15, y: 10 }, { x: 50, y: 9 }, { x: 72, y: 11 }, { x: 90, y: 10 },
  ];
  for (const cave of caveEntrances) {
    if (cave.y < H - 2 && cave.x < W - 2) {
      worldMap[cave.y][cave.x] = T.FROST_DUNGEON;
      worldMap[cave.y][cave.x + 1] = T.FROST_DUNGEON;
      // Path from cave down to snowfield
      for (let y = cave.y + 1; y <= cave.y + 3; y++) {
        if (y < H - 2) {
          if (worldMap[y][cave.x] === T.MOUNTAIN) worldMap[y][cave.x] = T.PATH;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FROZEN LAKE DISTRICT — multiple connected frozen lakes (center-east)
  // x: 55-95, y: 30-55
  // ═══════════════════════════════════════════════════════════════════════
  const lakes = [
    { cx: 65, cy: 38, rx: 7, ry: 5 },   // Main Lake
    { cx: 80, cy: 35, rx: 6, ry: 4 },   // North Lake
    { cx: 75, cy: 48, rx: 8, ry: 5 },   // South Lake
    { cx: 58, cy: 45, rx: 5, ry: 4 },   // West Lake
    { cx: 90, cy: 42, rx: 5, ry: 3 },   // East Lake (small)
  ];

  for (const lake of lakes) {
    // Ice border (ellipse, slightly larger)
    for (let y = lake.cy - lake.ry - 1; y <= lake.cy + lake.ry + 1; y++) {
      for (let x = lake.cx - lake.rx - 1; x <= lake.cx + lake.rx + 1; x++) {
        if (y < 2 || y >= H - 2 || x < 2 || x >= W - 2) continue;
        const dx = (x - lake.cx) / (lake.rx + 1);
        const dy = (y - lake.cy) / (lake.ry + 1);
        if (dx * dx + dy * dy <= 1.0) {
          worldMap[y][x] = T.ICE;
        }
      }
    }
    // Water center (inner ellipse)
    for (let y = lake.cy - lake.ry + 1; y <= lake.cy + lake.ry - 1; y++) {
      for (let x = lake.cx - lake.rx + 1; x <= lake.cx + lake.rx - 1; x++) {
        if (y < 2 || y >= H - 2 || x < 2 || x >= W - 2) continue;
        const dx = (x - lake.cx) / (lake.rx - 1);
        const dy = (y - lake.cy) / (lake.ry - 1);
        if (dx * dx + dy * dy <= 0.85) {
          worldMap[y][x] = T.WATER;
        }
      }
    }
  }

  // ── Rivers connecting the lakes ──
  // Main Lake -> North Lake
  for (let x = 66; x <= 78; x++) {
    const ry = 38 - Math.floor((x - 66) / 12 * 3) + Math.floor(Math.sin(x * 0.4) * 1);
    if (ry >= 2 && ry < H - 2) { worldMap[ry][x] = T.WATER; worldMap[ry - 1][x] = T.ICE; }
  }
  // Main Lake -> South Lake
  for (let y = 39; y <= 47; y++) {
    const rx = 67 + Math.floor(Math.sin(y * 0.5) * 2);
    if (rx >= 2 && rx < W - 2) { worldMap[y][rx] = T.WATER; worldMap[y][rx + 1] = T.ICE; }
  }
  // Main Lake -> West Lake
  for (let x = 58; x <= 63; x++) {
    const ry = 45 - Math.floor((x - 58) / 5 * 7);
    if (ry >= 2 && ry < H - 2) { worldMap[ry][x] = T.WATER; }
  }
  // North Lake -> East Lake
  for (let x = 82; x <= 89; x++) {
    const ry = 36 + Math.floor((x - 82) / 7 * 6) + Math.floor(Math.sin(x * 0.6) * 1);
    if (ry >= 2 && ry < H - 2) { worldMap[ry][x] = T.WATER; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FROZEN WATERFALL — landmark feature (x:95-100, y:18-28)
  // Visible from distance, partially climbable
  // ═══════════════════════════════════════════════════════════════════════
  const wfX = 97, wfTopY = 16, wfBottomY = 28;
  // Mountain cliff behind the waterfall
  for (let y = wfTopY - 2; y <= wfTopY + 2; y++) {
    for (let x = wfX - 3; x <= wfX + 3; x++) {
      if (y >= 2 && x >= 2 && x < W - 2) worldMap[y][x] = T.MOUNTAIN;
    }
  }
  // The frozen cascade (ice column, 3 wide)
  for (let y = wfTopY + 1; y <= wfBottomY; y++) {
    worldMap[y][wfX - 1] = T.ICE;
    worldMap[y][wfX] = T.ICE;
    worldMap[y][wfX + 1] = T.ICE;
  }
  // Frozen pool at the base
  for (let dy = 0; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const bx = wfX + dx, by = wfBottomY + 1 + dy;
      if (by < H - 2 && bx >= 2 && bx < W - 2) {
        const dist = Math.abs(dx) + dy;
        worldMap[by][bx] = dist <= 2 ? T.WATER : T.ICE;
      }
    }
  }
  // Climbable path alongside waterfall
  for (let y = wfBottomY; y >= wfTopY + 2; y--) {
    worldMap[y][wfX + 3] = T.PATH;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POLARIS — Main hub town (center, ~x:45-58, y:35-48)
  // Inn, workshop, arena, cantina, trading post, central plaza
  // ═══════════════════════════════════════════════════════════════════════
  const polX = 48, polY = 40; // center of Polaris

  // Clear a generous area (14x12) for the town
  for (let y = polY - 5; y <= polY + 6; y++) {
    for (let x = polX - 6; x <= polX + 7; x++) {
      if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
        worldMap[y][x] = T.PATH;
      }
    }
  }

  // Central plaza (6x4 warm stone)
  for (let y = polY - 1; y <= polY + 2; y++) {
    for (let x = polX - 2; x <= polX + 3; x++) {
      worldMap[y][x] = T.PLAZA;
    }
  }

  // Buildings arranged around the plaza
  // North side
  worldMap[polY - 4][polX - 3] = T.BUILDING;  // Trading Post (west)
  worldMap[polY - 4][polX - 2] = T.BUILDING;
  worldMap[polY - 4][polX + 3] = T.BUILDING;  // Arena (east)
  worldMap[polY - 4][polX + 4] = T.BUILDING;

  // South side
  worldMap[polY + 4][polX - 3] = T.BUILDING;  // Inn (southwest)
  worldMap[polY + 4][polX - 2] = T.BUILDING;
  worldMap[polY + 4][polX + 3] = T.WORKSHOP;  // Workshop (southeast)
  worldMap[polY + 4][polX + 4] = T.WORKSHOP;

  // East side — cantina
  worldMap[polY][polX + 6] = T.CANTINA;
  worldMap[polY + 1][polX + 6] = T.CANTINA;

  // West side — extra building
  worldMap[polY][polX - 5] = T.BUILDING;
  worldMap[polY + 1][polX - 5] = T.BUILDING;

  // Dungeons entrance south of town
  worldMap[polY + 6][polX] = T.DUNGEON;
  worldMap[polY + 6][polX + 1] = T.DUNGEON;

  // Wider path approaches into Polaris (N, S, E, W)
  // North approach
  for (let y = polY - 8; y < polY - 5; y++) {
    worldMap[y][polX] = T.PATH; worldMap[y][polX + 1] = T.PATH;
  }
  // South approach
  for (let y = polY + 7; y <= polY + 10; y++) {
    if (y < H - 2) { worldMap[y][polX] = T.PATH; worldMap[y][polX + 1] = T.PATH; }
  }
  // East approach
  for (let x = polX + 8; x <= polX + 12; x++) {
    if (x < W - 2) { worldMap[polY][x] = T.PATH; worldMap[polY + 1][x] = T.PATH; }
  }
  // West approach
  for (let x = polX - 10; x < polX - 6; x++) {
    if (x >= 2) { worldMap[polY][x] = T.PATH; worldMap[polY + 1][x] = T.PATH; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ICE DUNGEON — special dungeon entrance (x:18-24, y:18-24)
  // Crystalline entrance carved into a glacier
  // ═══════════════════════════════════════════════════════════════════════
  const idX = 20, idY = 22;

  // Surrounding ice field (8x8)
  for (let y = idY - 3; y <= idY + 4; y++) {
    for (let x = idX - 3; x <= idX + 4; x++) {
      if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
        worldMap[y][x] = T.ICE;
      }
    }
  }
  // Dungeon entrance tiles (3x3 center)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      worldMap[idY + dy][idX + dx] = T.FROST_DUNGEON;
    }
  }
  // Path leading to the dungeon from the south
  for (let y = idY + 5; y <= idY + 10; y++) {
    if (y < H - 2) { worldMap[y][idX] = T.PATH; worldMap[y][idX + 1] = T.PATH; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOGGING CAMP — smaller settlement in the woods (x:12-20, y:55-63)
  // ═══════════════════════════════════════════════════════════════════════
  const lcX = 16, lcY = 59;

  // Clear an area for the camp (8x6)
  for (let y = lcY - 2; y <= lcY + 3; y++) {
    for (let x = lcX - 3; x <= lcX + 4; x++) {
      if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
        worldMap[y][x] = T.PATH;
      }
    }
  }
  // Camp buildings
  worldMap[lcY - 1][lcX - 2] = T.BUILDING;  // Bunkhouse
  worldMap[lcY - 1][lcX - 1] = T.BUILDING;
  worldMap[lcY - 1][lcX + 2] = T.WORKSHOP;  // Sawmill
  worldMap[lcY - 1][lcX + 3] = T.WORKSHOP;
  worldMap[lcY + 2][lcX] = T.BUILDING;      // Supply shed
  worldMap[lcY + 2][lcX + 1] = T.BUILDING;

  // Log piles around camp (represented as snow with trees nearby — organic look)
  // Small clearing ring of snow around the camp
  for (let y = lcY - 4; y <= lcY + 5; y++) {
    for (let x = lcX - 5; x <= lcX + 6; x++) {
      if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
        if (worldMap[y][x] === T.SNOW) {
          // Keep a ring of open snow around the camp
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AURORA FIELDS — open tundra (x:60-100, y:58-78)
  // Minimal trees, wide open, encounter zone
  // ═══════════════════════════════════════════════════════════════════════
  // (Stays mostly snow by default — we just ensure no trees grow here)
  // Scatter a few ice patches for texture
  for (let y = 58; y < 78; y++) {
    for (let x = 60; x < 100; x++) {
      if (y >= H - 2 || x >= W - 2) continue;
      const n = fvTerrainNoise(x, y, 500);
      if (n > 0.82) {
        worldMap[y][x] = T.ICE; // small frozen puddles scattered across tundra
      }
    }
  }
  // Encounter zone markers (subtle, data-driven)
  // The encounter zone coordinates are stored but not visually painted per world-gen convention

  // ═══════════════════════════════════════════════════════════════════════
  // FROSTY WOODS — large dense snowy forest (x:3-45, y:16-55)
  // Noise-based organic forests with winding paths
  // ═══════════════════════════════════════════════════════════════════════

  // First pass: noise-based tree placement across the woods region
  for (let y = 16; y < 78; y++) {
    for (let x = 3; x < W - 2; x++) {
      if (worldMap[y][x] !== T.SNOW) continue;

      // Exclusion zones — keep settlements, lakes, Aurora Fields clear
      // Polaris town
      if (x >= polX - 8 && x <= polX + 9 && y >= polY - 6 && y <= polY + 8) continue;
      // Ice Dungeon area
      if (x >= idX - 5 && x <= idX + 6 && y >= idY - 5 && y <= idY + 12) continue;
      // Logging Camp
      if (x >= lcX - 6 && x <= lcX + 7 && y >= lcY - 5 && y <= lcY + 6) continue;
      // Frozen Lake District — sparse trees only
      if (x >= 53 && x <= 97 && y >= 28 && y <= 57) continue;
      // Aurora Fields — minimal trees
      if (x >= 58 && y >= 56) continue;
      // Frozen Waterfall area
      if (x >= wfX - 5 && x <= wfX + 5 && y >= wfTopY - 3 && y <= wfBottomY + 5) continue;

      // Determine density based on region
      let threshold = 0.75; // default dense forest

      // West side (Frosty Woods proper) — densest
      if (x < 45 && y >= 16 && y < 55) {
        threshold = 0.62; // very dense
      }
      // South-central — moderate
      else if (y >= 55 && x < 55) {
        threshold = 0.72;
      }
      // East side near lakes — sparser
      else if (x >= 45) {
        threshold = 0.82;
      }
      // Near the mountain edge — thin treeline
      if (y < 20) {
        threshold = 0.85;
      }

      const density = fvForestNoise(x, y, 142);
      if (density > threshold) {
        worldMap[y][x] = T.TREE;
      } else if (density > threshold - 0.08) {
        // Soft edge scatter
        const edgeChance = (density - (threshold - 0.08)) / 0.08;
        if (_fvHash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.25) {
          worldMap[y][x] = T.TREE;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PATHS — winding connections between all major areas
  // ═══════════════════════════════════════════════════════════════════════

  // Helper: carve a 2-wide path between two points (bresenham-ish with sine wobble)
  function carvePath(x0, y0, x1, y1, wobbleFreq, wobbleAmp) {
    const freq = wobbleFreq || 0.3;
    const amp = wobbleAmp || 1;
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let px = Math.round(x0 + dx * t);
      let py = Math.round(y0 + dy * t);
      // Add wobble perpendicular to the path direction
      if (Math.abs(dx) > Math.abs(dy)) {
        py += Math.round(Math.sin(i * freq) * amp);
      } else {
        px += Math.round(Math.sin(i * freq) * amp);
      }
      // Carve 2-wide
      for (let d = 0; d <= 1; d++) {
        const cx = px + (Math.abs(dy) > Math.abs(dx) ? d : 0);
        const cy = py + (Math.abs(dy) <= Math.abs(dx) ? d : 0);
        if (cy >= 2 && cy < H - 2 && cx >= 2 && cx < W - 2) {
          if (worldMap[cy][cx] === T.SNOW || worldMap[cy][cx] === T.TREE) {
            worldMap[cy][cx] = T.PATH;
          }
        }
      }
    }
  }

  // Main east-west highway through the center of the map
  for (let x = 3; x < W - 2; x++) {
    const py = 40 + Math.floor(Math.sin(x * 0.08) * 3);
    if (py >= 2 && py < H - 2) {
      worldMap[py][x] = T.PATH;
      if (py + 1 < H - 2) worldMap[py + 1][x] = T.PATH;
    }
  }

  // Crystal Caverns -> Polaris (mountain south to town)
  carvePath(cavernX, cavernY + 6, polX, polY - 8, 0.25, 2);

  // Ice Dungeon -> Polaris
  carvePath(idX, idY + 10, polX - 6, polY, 0.3, 1);

  // Polaris -> Frozen Lake District
  carvePath(polX + 8, polY, 60, 38, 0.2, 2);

  // Polaris -> Logging Camp
  carvePath(polX - 6, polY + 2, lcX + 4, lcY, 0.35, 2);

  // Logging Camp -> south edge (exit path)
  carvePath(lcX, lcY + 4, 20, H - 3, 0.2, 2);

  // Polaris -> Aurora Fields
  carvePath(polX + 6, polY + 5, 70, 62, 0.15, 2);

  // Polaris -> Frozen Waterfall
  carvePath(polX + 8, polY - 2, wfX - 4, wfBottomY + 2, 0.2, 1);

  // Lake District internal path (connecting lakes)
  carvePath(65, 43, 75, 48, 0.4, 1);
  carvePath(80, 39, 90, 42, 0.3, 1);
  carvePath(65, 38, 80, 35, 0.25, 1);

  // North-south through Frosty Woods
  for (let y = 16; y < 55; y++) {
    const px = 25 + Math.floor(Math.sin(y * 0.2) * 3);
    if (px >= 2 && px < W - 2) {
      worldMap[y][px] = T.PATH;
      worldMap[y][px + 1] = T.PATH;
    }
  }

  // Winding path through the eastern woods
  for (let y = 20; y < 60; y++) {
    const px = 50 + Math.floor(Math.sin(y * 0.15) * 2);
    if (px >= 2 && px < W - 2) {
      worldMap[y][px] = T.PATH;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HIDDEN MYSTERY — unmarked discovery location (x:5-9, y:72-76)
  // Rewards pure exploration, tucked in far southwest
  // ═══════════════════════════════════════════════════════════════════════
  const hmX = 7, hmY = 74;
  // Small hidden clearing
  for (let y = hmY - 2; y <= hmY + 2; y++) {
    for (let x = hmX - 2; x <= hmX + 2; x++) {
      if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
        const dist = Math.abs(x - hmX) + Math.abs(y - hmY);
        if (dist <= 2) worldMap[y][x] = T.ICE;
      }
    }
  }
  // Central mystery tile (frost dungeon — glowing)
  worldMap[hmY][hmX] = T.FROST_DUNGEON;
  // Surround with dense trees (no path leads here — pure exploration reward)
  for (let y = hmY - 4; y <= hmY + 4; y++) {
    for (let x = hmX - 4; x <= hmX + 4; x++) {
      if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
        const dist = Math.abs(x - hmX) + Math.abs(y - hmY);
        if (dist > 3 && worldMap[y][x] === T.SNOW) {
          worldMap[y][x] = T.TREE;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SCATTERED FEATURES — ice patches, snow drifts, lone trees
  // Makes the map feel lived-in and varied
  // ═══════════════════════════════════════════════════════════════════════

  // Small ice patches scattered across open snow areas
  for (let y = 15; y < H - 3; y++) {
    for (let x = 3; x < W - 3; x++) {
      if (worldMap[y][x] !== T.SNOW) continue;
      const n = fvTerrainNoise(x, y, 777);
      // Very sparse ice scatter for texture (frozen puddles, thin ice)
      if (n > 0.92) {
        worldMap[y][x] = T.ICE;
      }
    }
  }

  // Small frozen streams in the woods (3 thin streams)
  const streams = [
    { sx: 10, sy: 25, ex: 18, ey: 50 },
    { sx: 35, sy: 20, ex: 40, ey: 38 },
    { sx: 85, sy: 20, ex: 92, ey: 55 },
  ];
  for (const s of streams) {
    const dx = s.ex - s.sx, dy = s.ey - s.sy;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(s.sx + dx * t + Math.sin(i * 0.4) * 1.5);
      const y = Math.round(s.sy + dy * t);
      if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
        if (worldMap[y][x] === T.SNOW || worldMap[y][x] === T.TREE) {
          worldMap[y][x] = T.WATER;
        }
      }
    }
  }

  // ── Small clearings in dense forest (natural glades) ──
  const clearings = [
    { x: 12, y: 35, r: 3 }, { x: 30, y: 45, r: 4 }, { x: 38, y: 28, r: 3 },
    { x: 8, y: 48, r: 2 }, { x: 42, y: 52, r: 3 },
  ];
  for (const cl of clearings) {
    for (let y = cl.y - cl.r; y <= cl.y + cl.r; y++) {
      for (let x = cl.x - cl.r; x <= cl.x + cl.r; x++) {
        if (y >= 2 && y < H - 2 && x >= 2 && x < W - 2) {
          const dist = Math.sqrt((x - cl.x) ** 2 + (y - cl.y) ** 2);
          if (dist <= cl.r && worldMap[y][x] === T.TREE) {
            worldMap[y][x] = T.SNOW;
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ENCOUNTER ZONES (data for spawning, not visually painted)
  // ═══════════════════════════════════════════════════════════════════════
  const FROST_ENCOUNTER_ZONES = [
    { name: 'Crystal Glade', x: 30, y: 20, w: 8, h: 6 },
    { name: 'Frozen Hollow', x: 10, y: 35, w: 7, h: 5 },
    { name: 'Aurora Fields', x: 70, y: 62, w: 10, h: 8 },
    { name: 'Shimmer Basin', x: 65, y: 38, w: 9, h: 5 },
    { name: 'Permafrost Depths', x: 85, y: 42, w: 6, h: 6 },
    { name: 'Timber Ridge', x: 14, y: 55, w: 8, h: 6 },
    { name: 'Frozen Falls Approach', x: 92, y: 25, w: 6, h: 5 },
    { name: 'Northern Caves', x: 45, y: 10, w: 8, h: 5 },
    { name: 'Wolfwood Path', x: 25, y: 30, w: 7, h: 5 },
    { name: 'Tundra Wastes', x: 75, y: 70, w: 10, h: 6 },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL CLEANUP — clear trees adjacent to paths, buildings, dungeon tiles
  // Same pattern as world-gen.js
  // ═══════════════════════════════════════════════════════════════════════
  const importantTiles = new Set([
    T.PATH, T.BUILDING, T.WORKSHOP, T.CANTINA, T.PLAZA,
    T.DUNGEON, T.FROST_DUNGEON,
  ]);

  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (!importantTiles.has(worldMap[y][x])) continue;
      // Clear adjacent trees for breathing room
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
            if (worldMap[ny][nx] === T.TREE) {
              worldMap[ny][nx] = T.SNOW;
            }
          }
        }
      }
    }
  }

  return {
    encounterZones: FROST_ENCOUNTER_ZONES,
    landmarks: {
      polaris: { x: polX, y: polY },
      iceDungeon: { x: idX, y: idY },
      crystalCaverns: { x: cavernX, y: cavernY },
      frozenWaterfall: { x: wfX, y: wfBottomY },
      loggingCamp: { x: lcX, y: lcY },
      auroraFields: { x: 75, y: 65 },
      hiddenMystery: { x: hmX, y: hmY },
    },
  };
}
