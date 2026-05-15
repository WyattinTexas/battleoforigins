// ═══════════════════════════════════════════════════════════════════════════
// DARK CASTLE ZONE — Full 110x85 map: a massive dark demon village
// with a grand castle, winding streets, markets, and fortified walls.
// ═══════════════════════════════════════════════════════════════════════════

// Tile codes:
// 22=dark_stone  23=dark_wall  24=dark_path  25=dark_tree(dead)
// 26=castle_floor  27=dungeons  5=building  6=encounter_zone  7=mountain

// ── Noise helpers (mirrors world-gen.js patterns) ──
function _dcHash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}
function _dcNoise2d(x, y, freq) {
  const fx = x * freq, fy = y * freq;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const dx = fx - ix, dy = fy - iy;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const n00 = _dcHash(ix, iy) / 0x7fffffff;
  const n10 = _dcHash(ix + 1, iy) / 0x7fffffff;
  const n01 = _dcHash(ix, iy + 1) / 0x7fffffff;
  const n11 = _dcHash(ix + 1, iy + 1) / 0x7fffffff;
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}
function dcNoise(x, y, seed) {
  const s = seed || 0;
  const n1 = _dcNoise2d(x + s, y + s, 0.12);
  const n2 = _dcNoise2d(x + s + 100, y + s + 100, 0.25) * 0.4;
  const n3 = _dcNoise2d(x + s + 200, y + s + 200, 0.5) * 0.15;
  return Math.min(1, Math.max(0, n1 + n2 + n3));
}

// ── Utility: carve a winding path between two points ──
function carvePath(map, x0, y0, x1, y1, W, H, width, seed) {
  width = width || 2;
  seed = seed || 0;
  const steps = Math.abs(x1 - x0) + Math.abs(y1 - y0) + 10;
  let cx = x0, cy = y0;
  for (let i = 0; i < steps * 3; i++) {
    // Move toward target with organic wobble
    const dx = x1 - cx, dy = y1 - cy;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    // Bias toward target but allow wander
    const wobble = Math.sin(i * 0.7 + seed) * 1.5;
    if (Math.abs(dx) > Math.abs(dy) + wobble) {
      cx += dx > 0 ? 1 : -1;
    } else {
      cy += dy > 0 ? 1 : -1;
    }
    // Paint path width
    for (let pw = 0; pw < width; pw++) {
      for (let ph = 0; ph < width; ph++) {
        const px = Math.floor(cx) + pw, py = Math.floor(cy) + ph;
        if (px >= 3 && px < W - 3 && py >= 3 && py < H - 3) {
          map[py][px] = 24;
        }
      }
    }
  }
}

// ── Utility: place a rectangular building cluster ──
function placeBuilding(map, x, y, w, h, W, H, interior) {
  interior = interior || 26;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx, py = y + dy;
      if (px < 3 || px >= W - 3 || py < 3 || py >= H - 3) continue;
      if (dy === 0 || dy === h - 1 || dx === 0 || dx === w - 1) {
        map[py][px] = 23; // dark_wall border
      } else {
        map[py][px] = interior;
      }
    }
  }
}

// ── Utility: place a single building tile (shop/house) ──
function placeShop(map, x, y) {
  if (x >= 0 && x < map[0].length && y >= 0 && y < map.length) {
    map[y][x] = 5;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
function generateDarkCastle(worldMap, W, H) {
  // W = 110, H = 85

  // ── 1. FILL EVERYTHING WITH DARK STONE ──
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      worldMap[y][x] = 22; // dark_stone ground
    }
  }

  // ── 2. OUTER WALLS & GATES — fortified perimeter ──
  // Thick outer wall (2 tiles wide on all edges)
  for (let x = 0; x < W; x++) {
    worldMap[0][x] = 7; worldMap[1][x] = 7;
    worldMap[H - 1][x] = 7; worldMap[H - 2][x] = 7;
  }
  for (let y = 0; y < H; y++) {
    worldMap[y][0] = 7; worldMap[y][1] = 7;
    worldMap[y][W - 1] = 7; worldMap[y][W - 2] = 7;
  }

  // Inner fortification wall (dark_wall ring at 4 tiles in)
  for (let x = 3; x < W - 3; x++) {
    worldMap[3][x] = 23; worldMap[4][x] = 23;
    worldMap[H - 4][x] = 23; worldMap[H - 5][x] = 23;
  }
  for (let y = 3; y < H - 3; y++) {
    worldMap[y][3] = 23; worldMap[y][4] = 23;
    worldMap[y][W - 4] = 23; worldMap[y][W - 5] = 23;
  }

  // Guard towers at corners (5x5 dark_wall with castle_floor interior)
  const towerPositions = [
    { x: 2, y: 2 }, { x: W - 7, y: 2 },
    { x: 2, y: H - 7 }, { x: W - 7, y: H - 7 },
  ];
  for (const tp of towerPositions) {
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        const px = tp.x + dx, py = tp.y + dy;
        if (px >= 0 && px < W && py >= 0 && py < H) {
          if (dy === 0 || dy === 4 || dx === 0 || dx === 4) {
            worldMap[py][px] = 23;
          } else {
            worldMap[py][px] = 26;
          }
        }
      }
    }
  }

  // Additional guard towers along walls (midpoints)
  const midTowers = [
    { x: Math.floor(W / 2) - 2, y: 2 },     // north mid
    { x: Math.floor(W / 2) - 2, y: H - 7 }, // south mid
    { x: 2, y: Math.floor(H / 2) - 2 },     // west mid
    { x: W - 7, y: Math.floor(H / 2) - 2 }, // east mid
  ];
  for (const tp of midTowers) {
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        const px = tp.x + dx, py = tp.y + dy;
        if (px >= 0 && px < W && py >= 0 && py < H) {
          if (dy === 0 || dy === 4 || dx === 0 || dx === 4) {
            worldMap[py][px] = 23;
          } else {
            worldMap[py][px] = 26;
          }
        }
      }
    }
  }

  // Main gates — gaps in the inner wall
  // South gate (main entrance, x center)
  const gateX = Math.floor(W / 2) - 2;
  for (let dx = 0; dx < 4; dx++) {
    worldMap[3][gateX + dx] = 24;
    worldMap[4][gateX + dx] = 24;
    worldMap[H - 4][gateX + dx] = 24;
    worldMap[H - 5][gateX + dx] = 24;
  }
  // East gate
  const gateY = Math.floor(H / 2) - 1;
  for (let dy = 0; dy < 3; dy++) {
    worldMap[gateY + dy][3] = 24;
    worldMap[gateY + dy][4] = 24;
    worldMap[gateY + dy][W - 4] = 24;
    worldMap[gateY + dy][W - 5] = 24;
  }

  // ── 3. THE GRAND CASTLE — enormous centerpiece (22x16 tiles) ──
  // Positioned center-north of the map
  const castleX = Math.floor(W / 2) - 11; // ~44
  const castleY = 8;
  const castleW = 22;
  const castleH = 16;

  // Outer castle walls
  for (let dy = 0; dy < castleH; dy++) {
    for (let dx = 0; dx < castleW; dx++) {
      const px = castleX + dx, py = castleY + dy;
      if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
        if (dy === 0 || dy === castleH - 1 || dx === 0 || dx === castleW - 1) {
          worldMap[py][px] = 23; // castle walls
        } else {
          worldMap[py][px] = 26; // castle floor
        }
      }
    }
  }

  // Internal castle structure — dividing walls for wings
  // West wing wall (x = castleX + 7)
  for (let dy = 1; dy < castleH - 1; dy++) {
    if (dy !== 5 && dy !== 6 && dy !== 10 && dy !== 11) { // doorways
      worldMap[castleY + dy][castleX + 7] = 23;
    }
  }
  // East wing wall (x = castleX + 14)
  for (let dy = 1; dy < castleH - 1; dy++) {
    if (dy !== 5 && dy !== 6 && dy !== 10 && dy !== 11) {
      worldMap[castleY + dy][castleX + 14] = 23;
    }
  }
  // Central divider (horizontal, y = castleY + 8)
  for (let dx = 8; dx < 14; dx++) {
    if (dx !== 10 && dx !== 11) { // central doorway
      worldMap[castleY + 8][castleX + dx] = 23;
    }
  }

  // Throne room — center of castle upper half (special floor)
  // The throne area is the top-center wing
  for (let dy = 1; dy < 8; dy++) {
    for (let dx = 8; dx < 14; dx++) {
      const px = castleX + dx, py = castleY + dy;
      worldMap[py][px] = 26; // already castle floor, mark explicitly
    }
  }
  // Throne itself (building tiles at the back wall of throne room)
  worldMap[castleY + 1][castleX + 10] = 5;
  worldMap[castleY + 1][castleX + 11] = 5;
  worldMap[castleY + 2][castleX + 10] = 5;
  worldMap[castleY + 2][castleX + 11] = 5;

  // Castle entrance — gap in south wall, leads to THE ANTECHAMBER
  worldMap[castleY + castleH - 1][castleX + 10] = 26;
  worldMap[castleY + castleH - 1][castleX + 11] = 26;

  // Castle towers at four corners (3x3 each, protruding outward)
  const castleTowers = [
    { x: castleX - 2, y: castleY - 2 },
    { x: castleX + castleW - 1, y: castleY - 2 },
    { x: castleX - 2, y: castleY + castleH - 1 },
    { x: castleX + castleW - 1, y: castleY + castleH - 1 },
  ];
  for (const ct of castleTowers) {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const px = ct.x + dx, py = ct.y + dy;
        if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
          if (dy === 0 || dy === 2 || dx === 0 || dx === 2) {
            worldMap[py][px] = 23;
          } else {
            worldMap[py][px] = 26;
          }
        }
      }
    }
  }

  // ── 4. THE ANTECHAMBER — castle entrance hall (south of castle) ──
  const anteX = castleX + 6;
  const anteY = castleY + castleH;
  const anteW = 10;
  const anteH = 5;
  for (let dy = 0; dy < anteH; dy++) {
    for (let dx = 0; dx < anteW; dx++) {
      const px = anteX + dx, py = anteY + dy;
      if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
        if (dy === anteH - 1 || (dx === 0 && dy > 0) || (dx === anteW - 1 && dy > 0)) {
          worldMap[py][px] = 23;
        } else {
          worldMap[py][px] = 26;
        }
      }
    }
  }
  // Antechamber entrance (south wall gap)
  worldMap[anteY + anteH - 1][anteX + 4] = 26;
  worldMap[anteY + anteH - 1][anteX + 5] = 26;

  // ── 5. THE UNDERCRYPT — dungeon entrance beneath the castle ──
  // Located under the castle's west wing
  const cryptX = castleX + 1;
  const cryptY = castleY + 10;
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      const px = cryptX + dx, py = cryptY + dy;
      if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
        worldMap[py][px] = 27; // dungeons
      }
    }
  }

  // ── 6. MAIN STREET SYSTEM — winding cobblestone paths ──
  // Grand Boulevard: south gate up to castle entrance
  const blvdX = Math.floor(W / 2);
  for (let y = anteY + anteH; y < H - 5; y++) {
    const wobble = Math.floor(Math.sin(y * 0.3 + 2.0) * 1.5);
    for (let dx = -1; dx <= 2; dx++) {
      const px = blvdX + wobble + dx;
      if (px >= 5 && px < W - 5) {
        worldMap[y][px] = 24;
      }
    }
  }

  // Connect boulevard to antechamber entrance
  for (let y = anteY + anteH - 2; y <= anteY + anteH + 2; y++) {
    for (let dx = -1; dx <= 2; dx++) {
      const px = anteX + 4 + dx;
      if (px >= 5 && px < W - 5 && y >= 5 && y < H - 5) {
        worldMap[y][px] = 24;
      }
    }
  }

  // East-West Cross Streets (organic, winding)
  const crossStreetYs = [32, 42, 52, 62, 72];
  for (const streetY of crossStreetYs) {
    for (let x = 5; x < W - 5; x++) {
      const wobble = Math.floor(Math.sin(x * 0.25 + streetY * 0.5) * 1.2);
      const py = streetY + wobble;
      if (py >= 5 && py < H - 5) {
        worldMap[py][x] = 24;
        if (py + 1 < H - 5) worldMap[py + 1][x] = 24;
      }
    }
  }

  // North-South side streets (left and right of boulevard)
  const sideStreetXs = [20, 35, 75, 90];
  for (const streetX of sideStreetXs) {
    for (let y = 5; y < H - 5; y++) {
      const wobble = Math.floor(Math.sin(y * 0.35 + streetX * 0.4) * 1.3);
      const px = streetX + wobble;
      if (px >= 5 && px < W - 5) {
        worldMap[y][px] = 24;
        if (px + 1 < W - 5) worldMap[y][px + 1] = 24;
      }
    }
  }

  // Diagonal alleys — shortcuts through blocks
  // NW to SE alley
  carvePath(worldMap, 12, 28, 40, 55, W, H, 2, 7.3);
  // NE to SW alley
  carvePath(worldMap, 85, 30, 65, 58, W, H, 2, 3.7);
  // SW winding alley
  carvePath(worldMap, 15, 60, 35, 75, W, H, 2, 11.2);
  // SE winding alley
  carvePath(worldMap, 95, 55, 75, 75, W, H, 2, 5.1);

  // Ring road around the castle
  const ringMargin = 4;
  const rLeft = castleX - ringMargin;
  const rRight = castleX + castleW + ringMargin;
  const rTop = castleY - ringMargin;
  const rBot = anteY + anteH + ringMargin;
  for (let x = rLeft; x <= rRight; x++) {
    if (x >= 5 && x < W - 5) {
      if (rTop >= 5) { worldMap[rTop][x] = 24; worldMap[rTop + 1][x] = 24; }
      if (rBot < H - 5) { worldMap[rBot][x] = 24; worldMap[rBot + 1][x] = 24; }
    }
  }
  for (let y = rTop; y <= rBot; y++) {
    if (y >= 5 && y < H - 5) {
      if (rLeft >= 5) { worldMap[y][rLeft] = 24; worldMap[y][rLeft + 1] = 24; }
      if (rRight < W - 5) { worldMap[y][rRight] = 24; worldMap[y][rRight + 1] = 24; }
    }
  }

  // ── 7. SHADOW MARKET — underground trade hub (south-east quadrant) ──
  const smX = 70, smY = 45;
  const smW = 16, smH = 10;
  // Market floor
  for (let dy = 0; dy < smH; dy++) {
    for (let dx = 0; dx < smW; dx++) {
      const px = smX + dx, py = smY + dy;
      if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
        if (dy === 0 || dy === smH - 1 || dx === 0 || dx === smW - 1) {
          worldMap[py][px] = 23; // market walls
        } else {
          worldMap[py][px] = 24; // walkable market floor
        }
      }
    }
  }
  // Market entrances (gaps in walls)
  worldMap[smY][smX + 7] = 24; worldMap[smY][smX + 8] = 24; // north entrance
  worldMap[smY + smH - 1][smX + 7] = 24; worldMap[smY + smH - 1][smX + 8] = 24; // south
  worldMap[smY + 4][smX] = 24; worldMap[smY + 5][smX] = 24; // west
  worldMap[smY + 4][smX + smW - 1] = 24; worldMap[smY + 5][smX + smW - 1] = 24; // east
  // Market stalls (buildings inside)
  const marketStalls = [
    { x: smX + 2, y: smY + 2 }, { x: smX + 5, y: smY + 2 },
    { x: smX + 9, y: smY + 2 }, { x: smX + 12, y: smY + 2 },
    { x: smX + 2, y: smY + 6 }, { x: smX + 5, y: smY + 6 },
    { x: smX + 9, y: smY + 6 }, { x: smX + 12, y: smY + 6 },
  ];
  for (const ms of marketStalls) {
    if (ms.x >= 5 && ms.x < W - 5 && ms.y >= 5 && ms.y < H - 5) {
      worldMap[ms.y][ms.x] = 5;
      if (ms.x + 1 < W - 5) worldMap[ms.y][ms.x + 1] = 5;
    }
  }
  // Underground entrance in the market center
  worldMap[smY + 4][smX + 7] = 27;
  worldMap[smY + 4][smX + 8] = 27;
  worldMap[smY + 5][smX + 7] = 27;
  worldMap[smY + 5][smX + 8] = 27;

  // ── 8. DEMON QUARTER — residential area (south-west quadrant) ──
  const dqX = 10, dqY = 45;

  // Houses scattered organically through the quarter
  const demonHouses = [
    // Row 1
    { x: dqX, y: dqY, w: 3, h: 3 },
    { x: dqX + 6, y: dqY + 1, w: 4, h: 3 },
    { x: dqX + 13, y: dqY, w: 3, h: 4 },
    { x: dqX + 19, y: dqY + 1, w: 3, h: 3 },
    { x: dqX + 25, y: dqY, w: 4, h: 3 },
    // Row 2
    { x: dqX + 2, y: dqY + 7, w: 3, h: 3 },
    { x: dqX + 8, y: dqY + 8, w: 3, h: 3 },
    { x: dqX + 14, y: dqY + 7, w: 4, h: 3 },
    { x: dqX + 21, y: dqY + 8, w: 3, h: 3 },
    // Row 3
    { x: dqX + 1, y: dqY + 14, w: 3, h: 3 },
    { x: dqX + 7, y: dqY + 15, w: 3, h: 3 },
    { x: dqX + 13, y: dqY + 14, w: 4, h: 4 },
    { x: dqX + 20, y: dqY + 15, w: 3, h: 3 },
    { x: dqX + 26, y: dqY + 14, w: 3, h: 3 },
    // Row 4
    { x: dqX + 3, y: dqY + 21, w: 3, h: 3 },
    { x: dqX + 9, y: dqY + 22, w: 4, h: 3 },
    { x: dqX + 16, y: dqY + 21, w: 3, h: 4 },
    { x: dqX + 22, y: dqY + 22, w: 3, h: 3 },
  ];

  for (const house of demonHouses) {
    placeBuilding(worldMap, house.x, house.y, house.w, house.h, W, H, 26);
  }

  // Eerie gardens between houses (dead trees in small clusters)
  const gardenSpots = [
    { x: dqX + 4, y: dqY + 4 }, { x: dqX + 11, y: dqY + 5 },
    { x: dqX + 18, y: dqY + 4 }, { x: dqX + 5, y: dqY + 11 },
    { x: dqX + 12, y: dqY + 11 }, { x: dqX + 24, y: dqY + 5 },
    { x: dqX + 4, y: dqY + 18 }, { x: dqX + 11, y: dqY + 18 },
    { x: dqX + 23, y: dqY + 11 }, { x: dqX + 25, y: dqY + 19 },
    { x: dqX + 7, y: dqY + 25 }, { x: dqX + 20, y: dqY + 25 },
  ];
  for (const gs of gardenSpots) {
    // Small garden patch: 2x2 dead trees
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const px = gs.x + dx, py = gs.y + dy;
        if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5 && worldMap[py][px] === 22) {
          worldMap[py][px] = 25;
        }
      }
    }
  }

  // Paths winding through the Demon Quarter
  carvePath(worldMap, dqX + 1, dqY + 3, dqX + 28, dqY + 3, W, H, 2, 13.0);
  carvePath(worldMap, dqX + 1, dqY + 10, dqX + 28, dqY + 10, W, H, 2, 9.5);
  carvePath(worldMap, dqX + 1, dqY + 17, dqX + 28, dqY + 17, W, H, 2, 6.2);
  carvePath(worldMap, dqX + 1, dqY + 24, dqX + 28, dqY + 24, W, H, 2, 4.8);

  // ── 9. THE CLOCKTOWER — special tall landmark ──
  // Positioned east side of map, visible from many streets
  const ctX = 90, ctY = 35;
  // Base (5x5 dark_wall with castle_floor)
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      const px = ctX + dx, py = ctY + dy;
      if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
        if (dy === 0 || dy === 4 || dx === 0 || dx === 4) {
          worldMap[py][px] = 23;
        } else {
          worldMap[py][px] = 26;
        }
      }
    }
  }
  // Inner tower core (1x1 building tile — the clock mechanism)
  worldMap[ctY + 2][ctX + 2] = 5;
  // Path approach to clocktower
  for (let dx = -3; dx < 0; dx++) {
    const px = ctX + dx;
    if (px >= 5) { worldMap[ctY + 2][px] = 24; worldMap[ctY + 3][px] = 24; }
  }
  for (let dx = 5; dx < 8; dx++) {
    const px = ctX + dx;
    if (px < W - 5) { worldMap[ctY + 2][px] = 24; worldMap[ctY + 3][px] = 24; }
  }

  // ── 10. ADDITIONAL BUILDINGS — shops, inns, armories along streets ──
  // These fill the streets with urban density

  // North district buildings (between inner wall and castle ring road)
  const northBuildings = [
    // West of castle
    { x: 12, y: 10 }, { x: 15, y: 10 }, { x: 18, y: 12 },
    { x: 12, y: 15 }, { x: 16, y: 16 }, { x: 22, y: 10 },
    { x: 25, y: 13 }, { x: 28, y: 10 }, { x: 22, y: 16 },
    { x: 10, y: 20 }, { x: 14, y: 22 }, { x: 18, y: 20 },
    { x: 25, y: 20 }, { x: 30, y: 18 }, { x: 10, y: 26 },
    { x: 14, y: 28 }, { x: 20, y: 26 }, { x: 26, y: 26 },
    { x: 30, y: 24 }, { x: 34, y: 22 },
    // East of castle
    { x: 78, y: 10 }, { x: 82, y: 12 }, { x: 85, y: 10 },
    { x: 88, y: 13 }, { x: 92, y: 10 }, { x: 96, y: 12 },
    { x: 78, y: 16 }, { x: 82, y: 18 }, { x: 86, y: 16 },
    { x: 90, y: 18 }, { x: 95, y: 16 }, { x: 99, y: 14 },
    { x: 78, y: 22 }, { x: 83, y: 24 }, { x: 88, y: 22 },
    { x: 93, y: 24 }, { x: 98, y: 20 }, { x: 100, y: 26 },
  ];

  for (const nb of northBuildings) {
    placeShop(worldMap, nb.x, nb.y);
    if (nb.x + 1 < W - 5) placeShop(worldMap, nb.x + 1, nb.y);
  }

  // South district (east side) — more scattered buildings
  const southEastBuildings = [
    { x: 72, y: 60 }, { x: 76, y: 58 }, { x: 80, y: 60 },
    { x: 84, y: 62 }, { x: 88, y: 58 }, { x: 92, y: 60 },
    { x: 96, y: 62 }, { x: 100, y: 58 }, { x: 74, y: 66 },
    { x: 78, y: 68 }, { x: 82, y: 66 }, { x: 86, y: 68 },
    { x: 90, y: 66 }, { x: 94, y: 68 }, { x: 98, y: 66 },
    { x: 72, y: 72 }, { x: 76, y: 74 }, { x: 80, y: 72 },
    { x: 84, y: 74 }, { x: 88, y: 72 }, { x: 92, y: 74 },
    { x: 96, y: 72 }, { x: 100, y: 74 },
  ];
  for (const sb of southEastBuildings) {
    placeShop(worldMap, sb.x, sb.y);
    if (sb.x + 1 < W - 5) placeShop(worldMap, sb.x + 1, sb.y);
  }

  // ── 11. SCATTERED PLAZAS — small gathering spots at street intersections ──
  const plazas = [
    { x: 20, y: 32, w: 4, h: 4 },  // north-west plaza
    { x: 88, y: 32, w: 4, h: 4 },  // north-east plaza
    { x: 25, y: 55, w: 5, h: 4 },  // demon quarter entrance plaza
    { x: 55, y: 65, w: 4, h: 4 },  // south central plaza
    { x: 50, y: 38, w: 5, h: 4 },  // castle south plaza (near antechamber)
  ];
  for (const pl of plazas) {
    for (let dy = 0; dy < pl.h; dy++) {
      for (let dx = 0; dx < pl.w; dx++) {
        const px = pl.x + dx, py = pl.y + dy;
        if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
          worldMap[py][px] = 24; // walkable plaza stones
        }
      }
    }
    // Lantern spots (building tiles at plaza corners)
    placeShop(worldMap, pl.x, pl.y);
    placeShop(worldMap, pl.x + pl.w - 1, pl.y);
    placeShop(worldMap, pl.x, pl.y + pl.h - 1);
    placeShop(worldMap, pl.x + pl.w - 1, pl.y + pl.h - 1);
  }

  // ── 12. VERTICALITY MARKERS — tower buildings & underground entrances ──
  // Tower buildings (tall structures, rendered differently by WorldScene)
  const towers = [
    { x: 15, y: 35 }, { x: 30, y: 30 },
    { x: 85, y: 30 }, { x: 98, y: 40 },
    { x: 18, y: 58 }, { x: 50, y: 75 },
    { x: 95, y: 55 }, { x: 60, y: 35 },
  ];
  for (const tw of towers) {
    // 3x3 tower with castle_floor interior
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const px = tw.x + dx, py = tw.y + dy;
        if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
          if (dy === 0 || dy === 2 || dx === 0 || dx === 2) {
            worldMap[py][px] = 23;
          } else {
            worldMap[py][px] = 26;
          }
        }
      }
    }
  }

  // Underground entrances scattered around the city
  const undergroundEntrances = [
    { x: 25, y: 42 }, { x: 50, y: 58 },
    { x: 85, y: 48 }, { x: 40, y: 70 },
    { x: 70, y: 38 }, { x: 15, y: 70 },
    { x: 95, y: 70 }, { x: 60, y: 55 },
  ];
  for (const ue of undergroundEntrances) {
    // 2x2 dungeon entrance
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const px = ue.x + dx, py = ue.y + dy;
        if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
          worldMap[py][px] = 27;
        }
      }
    }
    // Path approach to each entrance
    if (ue.y + 2 < H - 5) worldMap[ue.y + 2][ue.x] = 24;
    if (ue.y + 2 < H - 5 && ue.x + 1 < W - 5) worldMap[ue.y + 2][ue.x + 1] = 24;
  }

  // ── 13. DEAD TWISTED TREES — noise-based organic placement ──
  // Trees fill gaps between buildings and streets, giving an eerie feel
  for (let y = 5; y < H - 5; y++) {
    for (let x = 5; x < W - 5; x++) {
      if (worldMap[y][x] !== 22) continue; // only on empty dark_stone

      const density = dcNoise(x, y, 131);

      // Sparser near the castle (urban center should be more open)
      const distToCastle = Math.sqrt(
        Math.pow(x - (castleX + castleW / 2), 2) +
        Math.pow(y - (castleY + castleH / 2), 2)
      );
      const castleSparsity = Math.min(1, distToCastle / 30);

      // Trees only where density is high enough and far enough from castle
      const threshold = 0.70 + (1 - castleSparsity) * 0.2;

      if (density > threshold) {
        worldMap[y][x] = 25; // dark_tree
      } else if (density > threshold - 0.06) {
        // Soft edge scatter
        const edgeChance = (density - (threshold - 0.06)) / 0.06;
        if (_dcHash(x * 3, y * 5) / 0x7fffffff < edgeChance * 0.25) {
          worldMap[y][x] = 25;
        }
      }
    }
  }

  // ── 14. ENCOUNTER ZONES (invisible, for spawn logic) ──
  // These overlay on existing terrain without changing visuals
  // The ENCOUNTER_ZONES array in world-gen.js handles these already

  // ── 15. LANTERN SPOTS — small building tiles along main streets ──
  // Every ~8 tiles along main boulevard and cross streets
  for (let y = 30; y < H - 6; y += 8) {
    const wobble = Math.floor(Math.sin(y * 0.3 + 2.0) * 1.5);
    const lx = blvdX + wobble - 3;
    const rx = blvdX + wobble + 4;
    if (lx >= 5 && lx < W - 5 && worldMap[y][lx] === 22) worldMap[y][lx] = 5;
    if (rx >= 5 && rx < W - 5 && worldMap[y][rx] === 22) worldMap[y][rx] = 5;
  }
  for (const streetY of crossStreetYs) {
    for (let x = 10; x < W - 10; x += 10) {
      const wobble = Math.floor(Math.sin(x * 0.25 + streetY * 0.5) * 1.2);
      const py = streetY + wobble - 2;
      if (py >= 5 && py < H - 5 && worldMap[py][x] === 22) worldMap[py][x] = 5;
    }
  }

  // ── 16. CLEAR TREES FROM PATHS AND BUILDINGS (final pass) ──
  // Same pattern as world-gen.js — ensure walkable tiles have breathing room
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = worldMap[y][x];
      if (t === 24 || t === 5 || t === 26 || t === 27) {
        // Clear adjacent dead trees for breathing room
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
              if (worldMap[ny][nx] === 25) {
                worldMap[ny][nx] = 22; // dark_tree -> dark_stone
              }
            }
          }
        }
      }
    }
  }

  // ── 17. ADDITIONAL ORGANIC ALLEYS — small connecting paths ──
  // Short winding alleys connecting blocks that might otherwise be isolated
  const alleyConnections = [
    [8, 35, 8, 50], [30, 35, 30, 50], [40, 55, 55, 70],
    [60, 30, 70, 45], [95, 35, 95, 55], [45, 42, 68, 42],
    [12, 42, 35, 42], [75, 42, 95, 42], [55, 75, 75, 75],
  ];
  for (const [x0, y0, x1, y1] of alleyConnections) {
    carvePath(worldMap, x0, y0, x1, y1, W, H, 1, x0 + y0);
  }

  // ── 18. SECOND DUNGEON COMPLEX — deep in the Demon Quarter ──
  const dq2X = dqX + 10, dq2Y = dqY + 20;
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      const px = dq2X + dx, py = dq2Y + dy;
      if (px >= 5 && px < W - 5 && py >= 5 && py < H - 5) {
        worldMap[py][px] = 27;
      }
    }
  }

  // ── 19. ENSURE ALL GATES CONNECT TO STREETS ──
  // North gate path
  for (let y = 5; y < 10; y++) {
    worldMap[y][gateX] = 24; worldMap[y][gateX + 1] = 24;
    worldMap[y][gateX + 2] = 24; worldMap[y][gateX + 3] = 24;
  }
  // Path from north gate to castle
  for (let y = 5; y < castleY; y++) {
    const px = Math.floor(W / 2);
    worldMap[y][px] = 24; worldMap[y][px + 1] = 24;
  }
  // South gate path
  for (let y = H - 8; y < H - 4; y++) {
    worldMap[y][gateX] = 24; worldMap[y][gateX + 1] = 24;
    worldMap[y][gateX + 2] = 24; worldMap[y][gateX + 3] = 24;
  }
  // West gate path
  for (let x = 5; x < 10; x++) {
    worldMap[gateY][x] = 24; worldMap[gateY + 1][x] = 24;
  }
  // East gate path
  for (let x = W - 8; x < W - 4; x++) {
    worldMap[gateY][x] = 24; worldMap[gateY + 1][x] = 24;
  }

  return worldMap;
}
