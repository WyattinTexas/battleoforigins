// ═══════════════════════════════════════════════════════════════════
// VOLCANIC ISLES — Full 110x85 Zone Generator
// Tropical paradise surrounding a deadly volcanic core.
// Water & fire. Beaches ring the outside, lava dominates the center.
// ═══════════════════════════════════════════════════════════════════

// Tile codes:
// 0=snow, 1=tree, 2=path, 3=water, 4=ice, 5=building, 6=encounter_zone,
// 7=mountain, 8=craft_building, 9=grass, 10=flowers, 11=rolling_hill,
// 12=cantina, 13=warm_tree, 14=volcanic_rock, 15=lava, 16=obsidian,
// 17=ash_ground, 18=magma_crystal, 19=plaza, 20=sand, 21=palm_tree,
// 22=dark_stone, 23=dark_wall, 24=dark_path, 25=dark_tree,
// 26=castle_floor, 27=dungeons, 28=frost_dungeon

// ── Noise utilities (mirrored from world-gen.js) ──
function _viHash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}
function _viNoise2d(x, y, freq) {
  const fx = x * freq, fy = y * freq;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const dx = fx - ix, dy = fy - iy;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const n00 = _viHash(ix, iy) / 0x7fffffff;
  const n10 = _viHash(ix + 1, iy) / 0x7fffffff;
  const n01 = _viHash(ix, iy + 1) / 0x7fffffff;
  const n11 = _viHash(ix + 1, iy + 1) / 0x7fffffff;
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}
function viNoise(x, y, seed) {
  const s = seed || 0;
  const n1 = _viNoise2d(x + s, y + s, 0.12);
  const n2 = _viNoise2d(x + s + 100, y + s + 100, 0.25) * 0.4;
  const n3 = _viNoise2d(x + s + 200, y + s + 200, 0.5) * 0.15;
  return Math.min(1, Math.max(0, n1 + n2 + n3));
}

// ── Distance helper ──
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

// ══════════════════════════════════════════════════════════════
// generateVolcanicIsles — fills ENTIRE 110x85 map
// ══════════════════════════════════════════════════════════════
function generateVolcanicIsles(worldMap, W, H) {
  const CX = Math.floor(W / 2);  // 55 — volcano center X
  const CY = Math.floor(H / 2);  // 42 — volcano center Y

  // ═══ PHASE 1: Base terrain — ocean everywhere ═══
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      worldMap[y][x] = 3; // water (open ocean)
    }
  }

  // ═══ PHASE 2: Island shape — organic landmass in the center ═══
  // The main island is an irregular oval, roughly 60x50 tiles, centered on the volcano.
  // Use noise to create organic coastline with inlets and peninsulas.
  const ISLAND_RX = 28; // base radius X
  const ISLAND_RY = 22; // base radius Y

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - CX) / ISLAND_RX;
      const dy = (y - CY) / ISLAND_RY;
      const baseDist = Math.sqrt(dx * dx + dy * dy);

      // Noise-based coastline wobble
      const coastNoise = viNoise(x, y, 333) * 0.35 + viNoise(x, y, 777) * 0.15;
      const threshold = 1.0 + coastNoise - 0.25;

      if (baseDist < threshold) {
        worldMap[y][x] = 17; // ash_ground (default island terrain)
      }
    }
  }

  // ═══ PHASE 3: Beach ring — sand where land meets water ═══
  // 2-3 tile wide sandy shore around the island perimeter
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (worldMap[y][x] !== 17) continue;
      // Check if any neighbor within 2 tiles is water
      let nearWater = false;
      for (let dy = -2; dy <= 2 && !nearWater; dy++) {
        for (let dx = -2; dx <= 2 && !nearWater; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W && worldMap[ny][nx] === 3) {
            nearWater = true;
          }
        }
      }
      if (nearWater) worldMap[y][x] = 20; // sand
    }
  }

  // Widen beaches — second pass for 3-tile wide beaches on outer edges
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (worldMap[y][x] !== 17) continue;
      let nearSand = false;
      for (let dy = -1; dy <= 1 && !nearSand; dy++) {
        for (let dx = -1; dx <= 1 && !nearSand; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W && worldMap[ny][nx] === 20) {
            nearSand = true;
          }
        }
      }
      // ~40% chance to extend beach inward for organic look
      if (nearSand && _viHash(x * 13, y * 17) / 0x7fffffff < 0.4) {
        worldMap[y][x] = 20;
      }
    }
  }

  // ═══ PHASE 4: The Volcano — massive central landmark ═══
  // Outer volcanic rock ring (radius ~10)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = dist(x, y, CX, CY);
      if (d <= 10) worldMap[y][x] = 14; // volcanic_rock
    }
  }
  // Obsidian ring (radius ~7)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = dist(x, y, CX, CY);
      if (d <= 7) worldMap[y][x] = 16; // obsidian
    }
  }
  // Lava core (radius ~4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = dist(x, y, CX, CY);
      if (d <= 4) worldMap[y][x] = 15; // lava
    }
  }
  // Extra lava bubbles around the core (radius 4-6, scattered)
  for (let y = CY - 8; y <= CY + 8; y++) {
    for (let x = CX - 8; x <= CX + 8; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const d = dist(x, y, CX, CY);
      if (d > 4 && d <= 6 && worldMap[y][x] === 16) {
        if (_viHash(x * 31, y * 37) / 0x7fffffff < 0.25) {
          worldMap[y][x] = 15; // lava bubble
        }
      }
    }
  }

  // ═══ PHASE 5: Lava rivers — 4 cardinal directions from volcano ═══

  // River NORTH: volcano up to near beach
  for (let y = 8; y < CY - 10; y++) {
    const lx = CX + Math.floor(Math.sin(y * 0.4) * 3);
    if (lx >= 2 && lx < W - 2) {
      worldMap[y][lx] = 15;
      worldMap[y][lx + 1] = 15;
      // Volcanic rock banks
      if (worldMap[y][lx - 1] === 17 || worldMap[y][lx - 1] === 20) worldMap[y][lx - 1] = 14;
      if (worldMap[y][lx + 2] === 17 || worldMap[y][lx + 2] === 20) worldMap[y][lx + 2] = 14;
    }
  }

  // River SOUTH: volcano down to near beach
  for (let y = CY + 11; y < H - 10; y++) {
    const lx = CX + Math.floor(Math.sin(y * 0.35) * 3);
    if (lx >= 2 && lx < W - 2) {
      worldMap[y][lx] = 15;
      worldMap[y][lx + 1] = 15;
      if (worldMap[y][lx - 1] === 17 || worldMap[y][lx - 1] === 20) worldMap[y][lx - 1] = 14;
      if (worldMap[y][lx + 2] === 17 || worldMap[y][lx + 2] === 20) worldMap[y][lx + 2] = 14;
    }
  }

  // River EAST: volcano right to near beach
  for (let x = CX + 11; x < W - 12; x++) {
    const ly = CY + Math.floor(Math.sin(x * 0.45) * 3);
    if (ly >= 2 && ly < H - 2) {
      worldMap[ly][x] = 15;
      worldMap[ly + 1][x] = 15;
      if (worldMap[ly - 1] && (worldMap[ly - 1][x] === 17 || worldMap[ly - 1][x] === 20)) worldMap[ly - 1][x] = 14;
      if (worldMap[ly + 2] && (worldMap[ly + 2][x] === 17 || worldMap[ly + 2][x] === 20)) worldMap[ly + 2][x] = 14;
    }
  }

  // River WEST: volcano left to near beach
  for (let x = 12; x < CX - 10; x++) {
    const ly = CY + Math.floor(Math.sin(x * 0.5) * 3);
    if (ly >= 2 && ly < H - 2) {
      worldMap[ly][x] = 15;
      worldMap[ly + 1][x] = 15;
      if (worldMap[ly - 1] && (worldMap[ly - 1][x] === 17 || worldMap[ly - 1][x] === 20)) worldMap[ly - 1][x] = 14;
      if (worldMap[ly + 2] && (worldMap[ly + 2][x] === 17 || worldMap[ly + 2][x] === 20)) worldMap[ly + 2][x] = 14;
    }
  }

  // ═══ PHASE 5b: Where lava rivers meet ocean — Obsidian Shores ═══
  // Steam vents and black sand where lava flows reach the coast
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (worldMap[y][x] !== 15) continue;
      // Check if lava is near sand or water (coastal lava)
      let nearCoast = false;
      for (let dy = -2; dy <= 2 && !nearCoast; dy++) {
        for (let dx = -2; dx <= 2 && !nearCoast; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
            if (worldMap[ny][nx] === 3 || worldMap[ny][nx] === 20) nearCoast = true;
          }
        }
      }
      if (nearCoast) {
        // Convert nearby sand to obsidian (black sand)
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < H && nx >= 0 && nx < W && worldMap[ny][nx] === 20) {
              worldMap[ny][nx] = 16; // obsidian (black sand)
            }
          }
        }
      }
    }
  }

  // ═══ PHASE 6: Outer islands — small satellite islands in the ocean ═══
  const outerIslands = [
    // NW cluster
    { cx: 12, cy: 12, r: 5 },
    { cx: 8, cy: 18, r: 3 },
    // NE cluster
    { cx: 96, cy: 10, r: 4 },
    { cx: 101, cy: 16, r: 3 },
    // SW cluster
    { cx: 10, cy: 68, r: 4 },
    { cx: 16, cy: 74, r: 3 },
    // SE cluster
    { cx: 98, cy: 70, r: 5 },
    { cx: 103, cy: 64, r: 3 },
    // Extra small islands for exploration
    { cx: 20, cy: 40, r: 3 },
    { cx: 90, cy: 42, r: 3 },
    { cx: 50, cy: 8, r: 2 },
    { cx: 60, cy: 78, r: 2 },
  ];
  for (const isle of outerIslands) {
    for (let y = isle.cy - isle.r; y <= isle.cy + isle.r; y++) {
      for (let x = isle.cx - isle.r; x <= isle.cx + isle.r; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        const d = dist(x, y, isle.cx, isle.cy);
        const wobble = viNoise(x, y, 555) * 1.5;
        if (d <= isle.r + wobble - 0.8) {
          // Outer ring is sand, interior is ash/ground
          if (d > isle.r - 1.5) {
            worldMap[y][x] = 20; // sand beach
          } else {
            worldMap[y][x] = 17; // ash ground interior
          }
        }
      }
    }
  }

  // ═══ PHASE 7: Blue Lagoons — hidden tropical pools with sand borders ═══
  const lagoons = [
    { cx: 35, cy: 28, rx: 4, ry: 3 },  // west lagoon
    { cx: 75, cy: 25, rx: 3, ry: 4 },  // NE lagoon
    { cx: 38, cy: 58, rx: 5, ry: 3 },  // SW lagoon (large)
    { cx: 72, cy: 60, rx: 4, ry: 3 },  // SE lagoon
    { cx: 55, cy: 20, rx: 3, ry: 3 },  // N lagoon
    { cx: 55, cy: 65, rx: 3, ry: 2 },  // S lagoon
  ];
  for (const lag of lagoons) {
    // Sand border first (slightly larger)
    for (let y = lag.cy - lag.ry - 2; y <= lag.cy + lag.ry + 2; y++) {
      for (let x = lag.cx - lag.rx - 2; x <= lag.cx + lag.rx + 2; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        const dx = (x - lag.cx) / (lag.rx + 1.5);
        const dy = (y - lag.cy) / (lag.ry + 1.5);
        if (dx * dx + dy * dy <= 1.0) {
          if (worldMap[y][x] === 17) worldMap[y][x] = 20; // sand around lagoon
        }
      }
    }
    // Water fill
    for (let y = lag.cy - lag.ry; y <= lag.cy + lag.ry; y++) {
      for (let x = lag.cx - lag.rx; x <= lag.cx + lag.rx; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        const dx = (x - lag.cx) / lag.rx;
        const dy = (y - lag.cy) / lag.ry;
        if (dx * dx + dy * dy <= 1.0) {
          worldMap[y][x] = 3; // water
        }
      }
    }
    // Palm trees around lagoons
    for (let dy = -lag.ry - 2; dy <= lag.ry + 2; dy++) {
      for (let dx = -lag.rx - 2; dx <= lag.rx + 2; dx++) {
        const px = lag.cx + dx, py = lag.cy + dy;
        if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) continue;
        if (worldMap[py][px] === 20 && _viHash(px * 19, py * 23) / 0x7fffffff < 0.2) {
          worldMap[py][px] = 21; // palm_tree
        }
      }
    }
  }

  // ═══ PHASE 8: Tidal Crossings — stepping stone paths across water ═══
  // These connect the outer beaches to the central volcano area.
  // Players need these to cross the ocean moat around the volcano.

  // Create a water moat ring around the volcano (between beach/land and the volcano)
  // First, carve a water ring at radius 14-18 from center
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = dist(x, y, CX, CY);
      if (d >= 14 && d <= 18) {
        // Only convert ash_ground to water (preserve lava rivers as bridges)
        if (worldMap[y][x] === 17) {
          worldMap[y][x] = 3; // water moat
        }
      }
    }
  }

  // Tidal crossing NORTH — stepping stones from north beach to volcano
  for (let y = CY - 18; y < CY - 10; y++) {
    const px = CX + Math.floor(Math.sin(y * 0.3) * 1);
    if (px >= 2 && px < W - 2) {
      worldMap[y][px] = 20;     // sand stepping stone
      worldMap[y][px + 1] = 20;
      // Every 3rd tile add a wider platform
      if (y % 3 === 0) {
        if (px - 1 >= 0) worldMap[y][px - 1] = 20;
        if (px + 2 < W) worldMap[y][px + 2] = 20;
      }
    }
  }

  // Tidal crossing SOUTH
  for (let y = CY + 11; y < CY + 19; y++) {
    const px = CX + Math.floor(Math.sin(y * 0.25) * 1);
    if (px >= 2 && px < W - 2) {
      worldMap[y][px] = 20;
      worldMap[y][px + 1] = 20;
      if (y % 3 === 0) {
        if (px - 1 >= 0) worldMap[y][px - 1] = 20;
        if (px + 2 < W) worldMap[y][px + 2] = 20;
      }
    }
  }

  // Tidal crossing EAST
  for (let x = CX + 11; x < CX + 19; x++) {
    const py = CY + Math.floor(Math.sin(x * 0.3) * 1);
    if (py >= 2 && py < H - 2) {
      worldMap[py][x] = 20;
      worldMap[py + 1][x] = 20;
      if (x % 3 === 0) {
        if (py - 1 >= 0) worldMap[py - 1][x] = 20;
        if (py + 2 < H) worldMap[py + 2][x] = 20;
      }
    }
  }

  // Tidal crossing WEST
  for (let x = CX - 18; x < CX - 10; x++) {
    const py = CY + Math.floor(Math.sin(x * 0.35) * 1);
    if (py >= 2 && py < H - 2) {
      worldMap[py][x] = 20;
      worldMap[py + 1][x] = 20;
      if (x % 3 === 0) {
        if (py - 1 >= 0) worldMap[py - 1][x] = 20;
        if (py + 2 < H) worldMap[py + 2][x] = 20;
      }
    }
  }

  // ═══ PHASE 9: Volcanic Settlement — trader outpost on south coast ═══
  const settleX = 45, settleY = 62;

  // Clear area — sand pad (10x8)
  for (let y = settleY - 2; y < settleY + 7; y++) {
    for (let x = settleX - 3; x < settleX + 8; x++) {
      if (x >= 1 && x < W - 1 && y >= 1 && y < H - 1) {
        worldMap[y][x] = 20; // sand
      }
    }
  }
  // Walkable plaza center (8x5)
  for (let y = settleY; y < settleY + 5; y++) {
    for (let x = settleX - 1; x < settleX + 7; x++) {
      if (x >= 1 && x < W - 1 && y >= 1 && y < H - 1) {
        worldMap[y][x] = 2; // path
      }
    }
  }
  // Central plaza tiles
  for (let y = settleY + 1; y < settleY + 4; y++) {
    for (let x = settleX + 1; x < settleX + 5; x++) {
      worldMap[y][x] = 19; // plaza
    }
  }
  // Buildings: Inn, Forge, Arena (The Crucible), Trading Post
  worldMap[settleY][settleX] = 5;          // Inn
  worldMap[settleY][settleX + 1] = 5;      // Inn (2-wide)
  worldMap[settleY][settleX + 5] = 5;      // Trading Post
  worldMap[settleY + 4][settleX] = 8;      // Forge (craft_building)
  worldMap[settleY + 4][settleX + 1] = 8;  // Forge (2-wide)
  worldMap[settleY + 4][settleX + 5] = 5;  // Arena — The Crucible
  worldMap[settleY + 4][settleX + 4] = 5;  // Arena (2-wide)
  // Cantina
  worldMap[settleY + 2][settleX - 1] = 12; // Lava Mug cantina
  // Framing palm trees
  const sPalms = [
    { x: settleX - 3, y: settleY - 2 }, { x: settleX + 8, y: settleY - 2 },
    { x: settleX - 3, y: settleY + 6 }, { x: settleX + 8, y: settleY + 6 },
    { x: settleX + 3, y: settleY - 2 }, { x: settleX - 3, y: settleY + 2 },
    { x: settleX + 8, y: settleY + 2 },
  ];
  for (const sp of sPalms) {
    if (sp.x >= 1 && sp.x < W - 1 && sp.y >= 1 && sp.y < H - 1) {
      worldMap[sp.y][sp.x] = 21;
    }
  }

  // ═══ PHASE 10: Volcano Interior — the Forge ═══
  // A walkable cave area inside the volcano crater (radius 3-4 from center)
  // The center of the volcano has a Forge building surrounded by volcanic rock floor
  // Carve interior paths within the obsidian ring
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const ix = CX + dx, iy = CY + dy;
      const d = dist(ix, iy, CX, CY);
      if (d <= 3.5 && d > 1.5) {
        worldMap[iy][ix] = 14; // volcanic_rock walkable floor
      }
    }
  }
  // The Forge — center of the volcano
  worldMap[CY][CX] = 8;         // Forge (craft_building)
  worldMap[CY][CX + 1] = 8;     // Forge (2-wide)
  worldMap[CY - 1][CX] = 14;    // approach tile
  worldMap[CY + 1][CX] = 14;    // approach tile
  worldMap[CY][CX - 1] = 14;    // approach tile

  // ═══ PHASE 11: Beach settlement — north coast outpost ═══
  const bsX = 55, bsY = 18;
  for (let y = bsY - 1; y < bsY + 4; y++) {
    for (let x = bsX - 2; x < bsX + 5; x++) {
      if (x >= 1 && x < W - 1 && y >= 1 && y < H - 1 && worldMap[y][x] !== 3) {
        worldMap[y][x] = 20;
      }
    }
  }
  for (let y = bsY; y < bsY + 3; y++) {
    for (let x = bsX - 1; x < bsX + 4; x++) {
      if (worldMap[y][x] !== 3) worldMap[y][x] = 2;
    }
  }
  worldMap[bsY][bsX] = 5;       // Dock house
  worldMap[bsY][bsX + 2] = 5;   // Beach shack
  worldMap[bsY + 2][bsX + 1] = 5; // Fishmonger

  // ═══ PHASE 12: East coast dock village ═══
  const edX = 82, edY = 40;
  for (let y = edY - 1; y < edY + 4; y++) {
    for (let x = edX - 2; x < edX + 4; x++) {
      if (x >= 1 && x < W - 1 && y >= 1 && y < H - 1 && worldMap[y][x] !== 3) {
        worldMap[y][x] = 20;
      }
    }
  }
  for (let y = edY; y < edY + 3; y++) {
    for (let x = edX - 1; x < edX + 3; x++) {
      if (worldMap[y][x] !== 3) worldMap[y][x] = 2;
    }
  }
  worldMap[edY][edX] = 5;       // Harbor master
  worldMap[edY + 2][edX + 1] = 5; // Supply depot

  // ═══ PHASE 13: Paths — connect settlements to each other and to volcano ═══

  // Path from south settlement north toward volcano
  for (let y = settleY - 2; y > CY + 12; y--) {
    const px = settleX + 2 + Math.floor(Math.sin(y * 0.2) * 2);
    if (px >= 1 && px < W - 1) {
      if (worldMap[y][px] === 17 || worldMap[y][px] === 20) worldMap[y][px] = 2;
      if (worldMap[y][px + 1] === 17 || worldMap[y][px + 1] === 20) worldMap[y][px + 1] = 2;
    }
  }

  // Path from north settlement south toward volcano
  for (let y = bsY + 4; y < CY - 12; y++) {
    const px = bsX + 1 + Math.floor(Math.sin(y * 0.25) * 2);
    if (px >= 1 && px < W - 1) {
      if (worldMap[y][px] === 17 || worldMap[y][px] === 20) worldMap[y][px] = 2;
      if (worldMap[y][px + 1] === 17 || worldMap[y][px + 1] === 20) worldMap[y][px + 1] = 2;
    }
  }

  // Coastal ring path — runs along the inner edge of the beach (circumnavigation)
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (worldMap[y][x] !== 20) continue; // only on sand
      // Check if there's ash_ground (interior) adjacent
      let nearInterior = false;
      for (let dy = -1; dy <= 1 && !nearInterior; dy++) {
        for (let dx = -1; dx <= 1 && !nearInterior; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W && worldMap[ny][nx] === 17) {
            nearInterior = true;
          }
        }
      }
      // Thin path: only convert ~30% of inner-beach tiles to path
      if (nearInterior && _viHash(x * 41, y * 43) / 0x7fffffff < 0.3) {
        worldMap[y][x] = 2;
      }
    }
  }

  // Path from east dock west toward volcano
  for (let x = edX - 3; x > CX + 12; x--) {
    const py = edY + 1 + Math.floor(Math.sin(x * 0.3) * 1);
    if (py >= 1 && py < H - 1) {
      if (worldMap[py][x] === 17 || worldMap[py][x] === 20) worldMap[py][x] = 2;
      if (worldMap[py + 1][x] === 17 || worldMap[py + 1][x] === 20) worldMap[py + 1][x] = 2;
    }
  }

  // Path connecting south settlement to east dock
  for (let x = settleX + 8; x < edX - 2; x++) {
    const py = 58 + Math.floor(Math.sin(x * 0.15) * 3);
    if (py >= 1 && py < H - 1 && x < W - 1) {
      if (worldMap[py][x] === 17 || worldMap[py][x] === 20) worldMap[py][x] = 2;
    }
  }

  // ═══ PHASE 14: Palm trees — noise-based organic groves ═══
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const t = worldMap[y][x];
      if (t !== 20 && t !== 17) continue; // only on sand or ash
      // No palms near the volcano center
      if (dist(x, y, CX, CY) < 20) continue;

      const density = viNoise(x, y, 155);
      // Denser palms on sand (beaches), sparser on ash (interior)
      if (t === 20) {
        if (density > 0.82) {
          worldMap[y][x] = 21;
        } else if (density > 0.76) {
          if (_viHash(x * 7, y * 11) / 0x7fffffff < 0.18) {
            worldMap[y][x] = 21;
          }
        }
      } else {
        // Ash ground — very sparse palms near lagoons only
        if (density > 0.9) {
          worldMap[y][x] = 21;
        }
      }
    }
  }

  // Outer islands get palms too
  for (const isle of outerIslands) {
    for (let y = isle.cy - isle.r - 1; y <= isle.cy + isle.r + 1; y++) {
      for (let x = isle.cx - isle.r - 1; x <= isle.cx + isle.r + 1; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        if (worldMap[y][x] === 20 && _viHash(x * 29, y * 31) / 0x7fffffff < 0.25) {
          worldMap[y][x] = 21;
        }
      }
    }
  }

  // ═══ PHASE 15: Obsidian formations — scattered clusters ═══
  const obsidianClusters = [
    { x: 40, y: 35 }, { x: 70, y: 35 }, { x: 55, y: 50 },
    { x: 35, y: 45 }, { x: 75, y: 50 }, { x: 60, y: 30 },
    { x: 50, y: 55 }, { x: 65, y: 55 }, { x: 45, y: 30 },
    { x: 80, y: 35 }, { x: 30, y: 38 }, { x: 68, y: 28 },
    { x: 42, y: 48 }, { x: 58, y: 60 }, { x: 72, y: 48 },
    { x: 38, y: 25 }, { x: 62, y: 22 }, { x: 78, y: 28 },
  ];
  for (const oc of obsidianClusters) {
    // 2x2 or 3x2 cluster
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1 + ((_viHash(oc.x, oc.y) & 1)); dx++) {
        const ox = oc.x + dx, oy = oc.y + dy;
        if (ox >= 1 && ox < W - 1 && oy >= 1 && oy < H - 1 && worldMap[oy][ox] === 17) {
          worldMap[oy][ox] = 16;
        }
      }
    }
  }

  // ═══ PHASE 16: Magma crystal nodes — scattered harvestable resources ═══
  for (let i = 0; i < 80; i++) {
    const mx = 10 + Math.floor(_viHash(i * 7, i * 13) / 0x7fffffff * (W - 20));
    const my = 10 + Math.floor(_viHash(i * 11, i * 17) / 0x7fffffff * (H - 20));
    if (mx < W - 2 && my < H - 2 && worldMap[my][mx] === 17) {
      worldMap[my][mx] = 18; // magma_crystal
    }
  }
  // Extra crystals near the volcano
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2;
    const r = 12 + Math.floor(_viHash(i * 23, i * 29) / 0x7fffffff * 8);
    const mx = CX + Math.floor(Math.cos(angle) * r);
    const my = CY + Math.floor(Math.sin(angle) * r);
    if (mx >= 1 && mx < W - 1 && my >= 1 && my < H - 1 && worldMap[my][mx] === 17) {
      worldMap[my][mx] = 18;
    }
  }

  // ═══ PHASE 17: Volcanic rock patches — irregular clusters near volcano ═══
  for (let y = CY - 25; y < CY + 25; y++) {
    for (let x = CX - 30; x < CX + 30; x++) {
      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
      if (worldMap[y][x] !== 17) continue;
      const d = dist(x, y, CX, CY);
      if (d < 22) {
        const rockChance = viNoise(x, y, 999);
        // More volcanic rock closer to the volcano
        const proximity = 1 - (d / 22);
        if (rockChance > 0.7 - proximity * 0.3) {
          worldMap[y][x] = 14; // volcanic_rock
        }
      }
    }
  }

  // ═══ PHASE 18: Encounter zones — marked areas for world bosses ═══
  const viEncounters = [
    { name: 'Ember Reef', cx: 35, cy: 30, w: 7, h: 5 },
    { name: 'Magma Pools', cx: 70, cy: 55, w: 7, h: 5 },
    { name: 'Obsidian Fields', cx: 75, cy: 35, w: 8, h: 6 },
    { name: 'Lava Shores', cx: 40, cy: 55, w: 7, h: 5 },
    { name: 'Tide Pools', cx: 25, cy: 45, w: 6, h: 5 },
    { name: 'Ash Wastes', cx: 60, cy: 50, w: 8, h: 6 },
    { name: 'Steam Vents', cx: 80, cy: 50, w: 6, h: 5 },
    { name: 'Coral Shallows', cx: 15, cy: 35, w: 6, h: 5 },
  ];
  // Encounter zones use tile 6 but we intentionally skip painting them
  // (per world-gen.js comment: "NPCs already wander the world; these micro-areas
  //  aren't needed visually. Zone data still exists for world boss spawning logic.")
  // Store on worldMap metadata if needed:
  if (!worldMap._encounterZones) worldMap._encounterZones = [];
  for (const ez of viEncounters) {
    worldMap._encounterZones.push({
      name: ez.name,
      x: ez.cx - Math.floor(ez.w / 2),
      y: ez.cy - Math.floor(ez.h / 2),
      w: ez.w,
      h: ez.h
    });
  }

  // ═══ PHASE 19: Border — impassable mountain ring ═══
  for (let x = 0; x < W; x++) {
    worldMap[0][x] = 7; worldMap[1][x] = 7;
    worldMap[H - 1][x] = 7; worldMap[H - 2][x] = 7;
  }
  for (let y = 0; y < H; y++) {
    worldMap[y][0] = 7; worldMap[y][1] = 7;
    worldMap[y][W - 1] = 7; worldMap[y][W - 2] = 7;
  }

  // ═══ PHASE 20: Clear trees from paths, buildings, and special tiles ═══
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = worldMap[y][x];
      if (t === 2 || t === 5 || t === 8 || t === 12 || t === 19) {
        // Clear adjacent palm trees for breathing room
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
              if (worldMap[ny][nx] === 21) {
                worldMap[ny][nx] = 20; // palm -> sand
              }
            }
          }
        }
      }
    }
  }

  // ═══ PHASE 21: Tide pools on beaches — small 1-2 tile water puddles ═══
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (worldMap[y][x] !== 20) continue; // only on sand
      // Near ocean water?
      let nearOcean = false;
      for (let dy = -2; dy <= 2 && !nearOcean; dy++) {
        for (let dx = -2; dx <= 2 && !nearOcean; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W && worldMap[ny][nx] === 3) {
            nearOcean = true;
          }
        }
      }
      if (nearOcean && _viHash(x * 53, y * 59) / 0x7fffffff < 0.06) {
        worldMap[y][x] = 3; // tiny tide pool
      }
    }
  }

  return worldMap;
}
