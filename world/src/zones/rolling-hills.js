// ═══════════════════════════════════════════════════════════════════
// ROLLING HILLS ZONE GENERATOR
// Stardew Valley meets the Shire — warm, alive, pastoral, layered
// Fills the full 110x85 map with rich Rolling Hills content
// ═══════════════════════════════════════════════════════════════════

// Tile codes reference:
// 0=snow, 1=tree, 2=path, 3=water, 4=ice, 5=building, 6=encounter_zone,
// 7=mountain, 8=craft_building, 9=grass, 10=flowers, 11=rolling_hill,
// 12=cantina, 13=warm_tree, 19=plaza, 20=sand, 21=palm_tree

// ═══ Noise utilities (same algorithm as world-gen.js) ═══
function _rhHash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

function _rhNoise2d(x, y, freq) {
  const fx = x * freq, fy = y * freq;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const dx = fx - ix, dy = fy - iy;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const n00 = _rhHash(ix, iy) / 0x7fffffff;
  const n10 = _rhHash(ix + 1, iy) / 0x7fffffff;
  const n01 = _rhHash(ix, iy + 1) / 0x7fffffff;
  const n11 = _rhHash(ix + 1, iy + 1) / 0x7fffffff;
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

function _rhForestNoise(x, y, seed) {
  const s = seed || 0;
  const n1 = _rhNoise2d(x + s, y + s, 0.12);
  const n2 = _rhNoise2d(x + s + 100, y + s + 100, 0.25) * 0.4;
  const n3 = _rhNoise2d(x + s + 200, y + s + 200, 0.5) * 0.15;
  return Math.min(1, Math.max(0, n1 + n2 + n3));
}

// Gentler noise for terrain variation (hills, flowers)
function _rhTerrainNoise(x, y, seed) {
  const s = seed || 0;
  const n1 = _rhNoise2d(x + s, y + s, 0.08);
  const n2 = _rhNoise2d(x + s + 50, y + s + 50, 0.18) * 0.35;
  return Math.min(1, Math.max(0, n1 + n2));
}

// ═══════════════════════════════════════════════════════════════════
// generateRollingHills(worldMap, W, H)
//
// Fills the ENTIRE 110x85 map as if it were a standalone Rolling Hills
// zone. Call this instead of generateWorld() when the player is in
// Rolling Hills (or use it to replace the RH section of the main map).
//
// The map is divided into named areas:
//   - Meadowbrook (main town)        ~center
//   - The Meadows (flower fields)     ~west/northwest
//   - Timber's Woods (dense forest)   ~east
//   - The Swamp Farm (wetlands)       ~southeast
//   - Windmill Ridge (high ground)    ~north-center
//   - River Valley (winding river)    ~cuts north-south
//   - The Old Mill (quest location)   ~northeast
//   - Festival Grounds (open area)    ~southwest
// ═══════════════════════════════════════════════════════════════════

function generateRollingHills(worldMap, W, H) {
  // --- Phase 1: Base terrain (all grass) ---
  for (let y = 0; y < H; y++) {
    worldMap[y] = [];
    for (let x = 0; x < W; x++) {
      worldMap[y][x] = 9; // grass
    }
  }

  // --- Border mountains ---
  for (let x = 0; x < W; x++) {
    worldMap[0][x] = 7; worldMap[1][x] = 7;
    worldMap[H - 1][x] = 7; worldMap[H - 2][x] = 7;
  }
  for (let y = 0; y < H; y++) {
    worldMap[y][0] = 7; worldMap[y][1] = 7;
    worldMap[y][W - 1] = 7; worldMap[y][W - 2] = 7;
  }

  // ═══════════════════════════════════════════════════
  // AREA BOUNDARIES (approximate, overlapping at edges)
  // ═══════════════════════════════════════════════════
  // Meadowbrook:       x:42-58, y:35-50
  // The Meadows:       x:3-38,  y:8-30
  // Timber's Woods:    x:70-107, y:8-55
  // The Swamp Farm:    x:60-85, y:58-78
  // Windmill Ridge:    x:35-55, y:5-18
  // River Valley:      x:~38 winding, y:3-82
  // The Old Mill:      x:88-96, y:12-20
  // Festival Grounds:  x:8-30,  y:58-75

  // ═══════════════════════════════════════════════════
  // RIVER VALLEY — winding river cutting north to south
  // ═══════════════════════════════════════════════════
  // Main river: enters from the north, meanders south, exits south border
  // Uses sine waves for organic meandering
  for (let y = 2; y < H - 2; y++) {
    // River center x oscillates between ~36 and ~42
    const riverCX = 39 + Math.floor(
      Math.sin(y * 0.08) * 4 +
      Math.sin(y * 0.17 + 1.2) * 2.5 +
      Math.sin(y * 0.31 + 3.0) * 1.2
    );
    // River width varies: narrower in the north (mountain source), wider in the valley
    const baseWidth = y < 15 ? 2 : y < 40 ? 3 : 4;
    const widthNoise = _rhTerrainNoise(riverCX, y, 300) > 0.6 ? 1 : 0;
    const halfW = Math.floor((baseWidth + widthNoise) / 2);

    for (let dx = -halfW; dx <= halfW; dx++) {
      const rx = riverCX + dx;
      if (rx >= 2 && rx < W - 2) {
        worldMap[y][rx] = 3; // water
      }
    }
    // Riverbank flowers on both sides (1-2 tiles)
    for (const side of [-1, 1]) {
      const bankX = riverCX + side * (halfW + 1);
      if (bankX >= 2 && bankX < W - 2 && worldMap[y][bankX] === 9) {
        if (_rhHash(bankX, y * 3) % 5 < 2) worldMap[y][bankX] = 10; // flowers
      }
    }
  }

  // Tributary stream: branches off west around y:25, flows toward The Meadows
  for (let i = 0; i < 25; i++) {
    const ty = 25 - Math.floor(i * 0.3);
    const tx = 39 - i + Math.floor(Math.sin(i * 0.4) * 1.5);
    if (tx >= 2 && tx < W - 2 && ty >= 2 && ty < H - 2) {
      worldMap[ty][tx] = 3;
      if (tx + 1 < W - 2) worldMap[ty][tx + 1] = 3;
    }
  }

  // Small pond where tributary pools up (~x:16, y:20)
  const pondCX = 16, pondCY = 20;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy * 1.8);
      if (dist < 2.8) {
        const px = pondCX + dx, py = pondCY + dy;
        if (px >= 2 && px < W - 2 && py >= 2 && py < H - 2) {
          worldMap[py][px] = 3;
        }
      }
    }
  }
  // Flowers around the pond
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy * 1.8);
      if (dist >= 2.8 && dist < 4.5) {
        const px = pondCX + dx, py = pondCY + dy;
        if (px >= 2 && px < W - 2 && py >= 2 && py < H - 2 && worldMap[py][px] === 9) {
          if (_rhHash(px * 7, py * 13) % 3 === 0) worldMap[py][px] = 10;
        }
      }
    }
  }

  // ═══ STONE BRIDGES across the river ═══
  // Bridge 1: near Windmill Ridge (y:12)
  const bridge1Y = 12;
  const bridge1CX = 39 + Math.floor(Math.sin(bridge1Y * 0.08) * 4 + Math.sin(bridge1Y * 0.17 + 1.2) * 2.5 + Math.sin(bridge1Y * 0.31 + 3.0) * 1.2);
  for (let dx = -3; dx <= 3; dx++) {
    const bx = bridge1CX + dx;
    if (bx >= 2 && bx < W - 2) { worldMap[bridge1Y][bx] = 2; worldMap[bridge1Y + 1][bx] = 2; }
  }

  // Bridge 2: near Meadowbrook (y:40)
  const bridge2Y = 40;
  const bridge2CX = 39 + Math.floor(Math.sin(bridge2Y * 0.08) * 4 + Math.sin(bridge2Y * 0.17 + 1.2) * 2.5 + Math.sin(bridge2Y * 0.31 + 3.0) * 1.2);
  for (let dx = -4; dx <= 4; dx++) {
    const bx = bridge2CX + dx;
    if (bx >= 2 && bx < W - 2) { worldMap[bridge2Y][bx] = 2; worldMap[bridge2Y + 1][bx] = 2; }
  }

  // Bridge 3: south, near Festival Grounds (y:65)
  const bridge3Y = 65;
  const bridge3CX = 39 + Math.floor(Math.sin(bridge3Y * 0.08) * 4 + Math.sin(bridge3Y * 0.17 + 1.2) * 2.5 + Math.sin(bridge3Y * 0.31 + 3.0) * 1.2);
  for (let dx = -3; dx <= 3; dx++) {
    const bx = bridge3CX + dx;
    if (bx >= 2 && bx < W - 2) { worldMap[bridge3Y][bx] = 2; worldMap[bridge3Y + 1][bx] = 2; }
  }

  // Fishing spots: small docks/path tiles extending into the river
  const fishingSpots = [
    { y: 18, side: 1 },   // east bank, north
    { y: 32, side: -1 },  // west bank, mid
    { y: 52, side: 1 },   // east bank, south
    { y: 72, side: -1 },  // west bank, far south
  ];
  for (const fs of fishingSpots) {
    const rcx = 39 + Math.floor(Math.sin(fs.y * 0.08) * 4 + Math.sin(fs.y * 0.17 + 1.2) * 2.5 + Math.sin(fs.y * 0.31 + 3.0) * 1.2);
    const halfW = fs.y < 15 ? 1 : fs.y < 40 ? 2 : 2;
    const dockStart = rcx + fs.side * (halfW + 1);
    for (let i = 0; i < 3; i++) {
      const dx = dockStart + fs.side * i;
      if (dx >= 2 && dx < W - 2) worldMap[fs.y][dx] = 2;
    }
  }

  // ═══════════════════════════════════════════════════
  // THE MEADOWS — wide open flower fields, rolling green hills
  // x:3-38, y:8-30 (west/northwest quadrant)
  // ═══════════════════════════════════════════════════
  for (let y = 8; y < 30; y++) {
    for (let x = 3; x < 36; x++) {
      if (worldMap[y][x] !== 9) continue; // don't overwrite river/water
      const flowerN = _rhTerrainNoise(x, y, 150);
      const hillN = _rhTerrainNoise(x, y, 210);

      // Dense flower patches (~35% coverage)
      if (flowerN > 0.55) {
        worldMap[y][x] = 10; // flowers
      }
      // Rolling hill mounds (~15% coverage, not overlapping flowers)
      else if (hillN > 0.72) {
        worldMap[y][x] = 11; // rolling_hill
      }
    }
  }

  // Scattered warm trees in The Meadows (very sparse, lone trees feel)
  for (let y = 8; y < 30; y++) {
    for (let x = 3; x < 36; x++) {
      if (worldMap[y][x] !== 9 && worldMap[y][x] !== 10) continue;
      const treeN = _rhForestNoise(x, y, 95);
      if (treeN > 0.92) {
        worldMap[y][x] = 13; // warm_tree — lone standing trees
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // WINDMILL RIDGE — elevated overlook area
  // x:40-58, y:5-18 (north-center, above the river)
  // ═══════════════════════════════════════════════════
  // Ridge terrain: rolling hills with some mountain accents
  for (let y = 4; y < 18; y++) {
    for (let x = 42; x < 62; x++) {
      if (x >= W - 2 || worldMap[y][x] === 3 || worldMap[y][x] === 7) continue;
      const ridgeN = _rhTerrainNoise(x, y, 180);
      if (ridgeN > 0.65) {
        worldMap[y][x] = 11; // rolling_hill — elevated terrain
      } else if (ridgeN > 0.45 && worldMap[y][x] === 9) {
        if (_rhHash(x * 11, y * 7) % 6 === 0) worldMap[y][x] = 10; // scattered flowers
      }
    }
  }

  // Windmill buildings (3 windmills along the ridge)
  const windmills = [
    { x: 47, y: 8 },
    { x: 52, y: 10 },
    { x: 56, y: 7 },
  ];
  for (const wm of windmills) {
    if (wm.x < W - 2 && wm.y < H - 2) {
      worldMap[wm.y][wm.x] = 5;     // windmill building
      worldMap[wm.y][wm.x + 1] = 5; // 2-wide
      // Clear path around each windmill
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          const px = wm.x + dx, py = wm.y + dy;
          if (px >= 2 && px < W - 2 && py >= 2 && py < H - 2) {
            if (worldMap[py][px] === 11 || worldMap[py][px] === 10) worldMap[py][px] = 9;
          }
        }
      }
    }
  }

  // Path along the ridge connecting windmills
  for (let x = 45; x < 59; x++) {
    if (x < W - 2) {
      const py = 9 + Math.floor(Math.sin(x * 0.3) * 1.5);
      if (py >= 2 && py < H - 2) { worldMap[py][x] = 2; }
    }
  }

  // ═══════════════════════════════════════════════════
  // TIMBER'S WOODS — deep deciduous forest, thick canopy
  // x:65-107, y:8-55 (east side of the map)
  // Interior gets darker/denser (reward for exploration)
  // ═══════════════════════════════════════════════════
  for (let y = 6; y < 55; y++) {
    for (let x = 62; x < W - 2; x++) {
      if (worldMap[y][x] !== 9) continue;

      // Distance from forest edge — deeper = denser
      const edgeDistX = Math.min(x - 62, (W - 3) - x);
      const edgeDistY = Math.min(y - 6, 54 - y);
      const edgeDist = Math.min(edgeDistX, edgeDistY);
      const depthFactor = Math.min(1, edgeDist / 12); // 0 at edge, 1 deep inside

      const density = _rhForestNoise(x, y, 120);

      // Edge: sparse trees (threshold ~0.75)
      // Deep interior: thick canopy (threshold ~0.40)
      const threshold = 0.78 - depthFactor * 0.38;

      if (density > threshold) {
        worldMap[y][x] = 13; // warm_tree
      } else if (density > threshold - 0.08) {
        // Soft scatter at edges
        const edgeChance = (density - (threshold - 0.08)) / 0.08;
        if (_rhHash(x * 5, y * 7) / 0x7fffffff < edgeChance * 0.25) {
          worldMap[y][x] = 13;
        }
      }
    }
  }

  // Forest clearings (small open spaces deep inside for exploration rewards)
  const clearings = [
    { x: 78, y: 20, r: 4 },  // mushroom circle clearing
    { x: 90, y: 35, r: 5 },  // large hidden glade
    { x: 85, y: 15, r: 3 },  // small sunlit patch
    { x: 95, y: 25, r: 3 },  // deep interior clearing
    { x: 72, y: 42, r: 4 },  // southern clearing
  ];
  for (const cl of clearings) {
    for (let dy = -cl.r; dy <= cl.r; dy++) {
      for (let dx = -cl.r; dx <= cl.r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < cl.r) {
          const cx = cl.x + dx, cy = cl.y + dy;
          if (cx >= 2 && cx < W - 2 && cy >= 2 && cy < H - 2) {
            if (dist < cl.r * 0.6) {
              // Inner clearing: flowers
              worldMap[cy][cx] = _rhHash(cx, cy * 3) % 3 === 0 ? 10 : 9;
            } else {
              // Outer ring: just grass
              worldMap[cy][cx] = 9;
            }
          }
        }
      }
    }
  }

  // Forest paths (winding trails through the woods)
  // Main east-west path entering forest from bridge area
  for (let x = 44; x < W - 4; x++) {
    const py = 20 + Math.floor(Math.sin(x * 0.12) * 3 + Math.sin(x * 0.25 + 2) * 1.5);
    if (py >= 2 && py < H - 2 && x < W - 2) {
      worldMap[py][x] = 2;
      if (py + 1 < H - 2) worldMap[py + 1][x] = 2;
    }
  }
  // North-south trail through forest interior
  for (let y = 10; y < 52; y++) {
    const px = 80 + Math.floor(Math.sin(y * 0.15) * 2.5);
    if (px >= 2 && px < W - 2) {
      worldMap[y][px] = 2;
      if (px + 1 < W - 2) worldMap[y][px + 1] = 2;
    }
  }
  // Branching trail to hidden glade
  for (let i = 0; i < 15; i++) {
    const bx = 82 + Math.floor(i * 0.6);
    const by = 28 + i;
    if (bx < W - 2 && by < H - 2) worldMap[by][bx] = 2;
  }

  // ═══════════════════════════════════════════════════
  // THE OLD MILL — abandoned structure, quest location
  // x:88-96, y:12-20 (northeast, deep in Timber's Woods)
  // ═══════════════════════════════════════════════════
  const millX = 92, millY = 16;
  // Clear area around the mill
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const mx = millX + dx, my = millY + dy;
      if (mx >= 2 && mx < W - 2 && my >= 2 && my < H - 2) {
        worldMap[my][mx] = 9; // clear the trees
      }
    }
  }
  // Mill building (2x2)
  worldMap[millY][millX] = 5; worldMap[millY][millX + 1] = 5;
  worldMap[millY + 1][millX] = 5; worldMap[millY + 1][millX + 1] = 5;
  // Mill wheel area (water channel)
  for (let dy = -1; dy <= 2; dy++) {
    const wy = millY + dy;
    if (wy >= 2 && wy < H - 2) worldMap[wy][millX + 2] = 3; // water channel beside mill
  }
  // Overgrown path leading to mill
  for (let x = millX - 4; x < millX; x++) {
    if (x >= 2) worldMap[millY + 1][x] = 2;
  }
  // Scattered flowers/grass around (abandoned, overgrown feel)
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const mx = millX + dx, my = millY + dy;
      if (mx >= 2 && mx < W - 2 && my >= 2 && my < H - 2 && worldMap[my][mx] === 9) {
        if (_rhHash(mx * 9, my * 11) % 4 === 0) worldMap[my][mx] = 10;
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // THE SWAMP FARM — misty wetland with unique terrain
  // x:60-88, y:58-78 (southeast quadrant)
  // ═══════════════════════════════════════════════════
  for (let y = 56; y < H - 4; y++) {
    for (let x = 58; x < 90; x++) {
      if (x >= W - 2) continue;
      if (worldMap[y][x] !== 9 && worldMap[y][x] !== 13) continue;

      const swampN = _rhTerrainNoise(x, y, 250);
      const waterN = _rhTerrainNoise(x, y, 330);

      // Scattered water pools (swamp puddles)
      if (waterN > 0.78) {
        worldMap[y][x] = 3; // water
      }
      // Swamp grass remains as regular grass but with flowers representing reeds
      else if (swampN > 0.65) {
        worldMap[y][x] = 10; // flowers (reeds/marsh plants)
      }
    }
  }

  // Rickety bridges across swamp (east-west paths)
  for (let x = 60; x < 86; x++) {
    if (x >= W - 2) continue;
    // Two crossing paths
    const py1 = 62;
    const py2 = 70;
    if (worldMap[py1][x] === 3 || worldMap[py1][x] === 9 || worldMap[py1][x] === 10) worldMap[py1][x] = 2;
    if (py2 < H - 2 && (worldMap[py2][x] === 3 || worldMap[py2][x] === 9 || worldMap[py2][x] === 10)) worldMap[py2][x] = 2;
  }
  // North-south path through swamp
  for (let y = 56; y < H - 3; y++) {
    const px = 72 + Math.floor(Math.sin(y * 0.2) * 2);
    if (px >= 2 && px < W - 2) worldMap[y][px] = 2;
  }

  // Swamp Farm buildings (small settlement)
  const swampFarmX = 68, swampFarmY = 64;
  // Clear area
  for (let dy = -2; dy <= 3; dy++) {
    for (let dx = -2; dx <= 4; dx++) {
      const sx = swampFarmX + dx, sy = swampFarmY + dy;
      if (sx >= 2 && sx < W - 2 && sy >= 2 && sy < H - 2) {
        worldMap[sy][sx] = 2; // path
      }
    }
  }
  worldMap[swampFarmY][swampFarmX] = 5;     // farmhouse
  worldMap[swampFarmY][swampFarmX + 2] = 5; // barn
  worldMap[swampFarmY + 2][swampFarmX + 1] = 8; // crop processing (craft building)

  // Rice paddies (small rectangular water patches near the farm)
  const paddies = [
    { x: 62, y: 66, w: 3, h: 2 },
    { x: 62, y: 69, w: 4, h: 2 },
    { x: 75, y: 66, w: 3, h: 3 },
  ];
  for (const p of paddies) {
    for (let dy = 0; dy < p.h; dy++) {
      for (let dx = 0; dx < p.w; dx++) {
        const px = p.x + dx, py = p.y + dy;
        if (px >= 2 && px < W - 2 && py >= 2 && py < H - 2) {
          worldMap[py][px] = 3;
        }
      }
    }
  }

  // Warm trees scattered through swamp (willows/cypress feel)
  for (let y = 56; y < H - 4; y++) {
    for (let x = 58; x < 90; x++) {
      if (x >= W - 2) continue;
      if (worldMap[y][x] !== 9 && worldMap[y][x] !== 10) continue;
      const treeN = _rhForestNoise(x, y, 170);
      if (treeN > 0.85) worldMap[y][x] = 13;
    }
  }

  // ═══════════════════════════════════════════════════
  // MEADOWBROOK — charming farm town (main hub)
  // Centered near x:50, y:42
  // ═══════════════════════════════════════════════════
  const mbX = 50, mbY = 42;

  // Clear a generous area for the town (16x14 walkable)
  for (let y = mbY - 6; y < mbY + 8; y++) {
    for (let x = mbX - 7; x < mbX + 9; x++) {
      if (x >= 2 && x < W - 2 && y >= 2 && y < H - 2) {
        worldMap[y][x] = 2; // path (town ground)
      }
    }
  }

  // Market Square (central plaza, 5x4)
  const plazaX = mbX - 2, plazaY = mbY - 1;
  for (let y = plazaY; y < plazaY + 4; y++) {
    for (let x = plazaX; x < plazaX + 5; x++) {
      if (x >= 2 && x < W - 2 && y >= 2 && y < H - 2) {
        worldMap[y][x] = 19; // plaza tile
      }
    }
  }

  // Buildings arranged around the market square
  // North row
  worldMap[mbY - 5][mbX - 4] = 5; worldMap[mbY - 5][mbX - 3] = 5; // General Store
  worldMap[mbY - 5][mbX + 2] = 5; worldMap[mbY - 5][mbX + 3] = 5; // Seed Shop

  // East side
  worldMap[mbY - 1][mbX + 6] = 5; worldMap[mbY - 1][mbX + 7] = 5; // Inn (2-wide)
  worldMap[mbY + 1][mbX + 6] = 5; worldMap[mbY + 1][mbX + 7] = 5; // Stables

  // West side
  worldMap[mbY - 1][mbX - 6] = 5; worldMap[mbY - 1][mbX - 5] = 5; // Herbalist
  worldMap[mbY + 1][mbX - 6] = 8; worldMap[mbY + 1][mbX - 5] = 8; // Workshop (craft building)

  // South row
  worldMap[mbY + 5][mbX - 3] = 12; worldMap[mbY + 5][mbX - 2] = 12; // Tavern (cantina type)
  worldMap[mbY + 5][mbX + 3] = 5;  worldMap[mbY + 5][mbX + 4] = 5;  // Town Hall

  // Flower planters around the market
  const planterSpots = [
    { x: plazaX - 1, y: plazaY }, { x: plazaX - 1, y: plazaY + 3 },
    { x: plazaX + 5, y: plazaY }, { x: plazaX + 5, y: plazaY + 3 },
    { x: plazaX + 1, y: plazaY - 1 }, { x: plazaX + 3, y: plazaY - 1 },
  ];
  for (const ps of planterSpots) {
    if (ps.x >= 2 && ps.x < W - 2 && ps.y >= 2 && ps.y < H - 2 && worldMap[ps.y][ps.x] === 2) {
      worldMap[ps.y][ps.x] = 10;
    }
  }

  // Well in the center of the plaza
  worldMap[plazaY + 1][plazaX + 2] = 3; // water tile (town well)

  // ═══════════════════════════════════════════════════
  // FESTIVAL GROUNDS — open area that hosts events
  // x:8-30, y:58-75 (southwest)
  // ═══════════════════════════════════════════════════
  // Large open flat area, mostly grass with decorative elements
  for (let y = 58; y < 75; y++) {
    for (let x = 8; x < 30; x++) {
      if (worldMap[y][x] !== 9) continue;
      // Slight flower ring around the perimeter
      const edgeX = Math.min(x - 8, 29 - x);
      const edgeY = Math.min(y - 58, 74 - y);
      if (edgeX <= 1 || edgeY <= 1) {
        if (_rhHash(x * 3, y * 7) % 3 === 0) worldMap[y][x] = 10;
      }
    }
  }

  // Festival stage/platform (small plaza area)
  const stageX = 18, stageY = 65;
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -2; dx <= 3; dx++) {
      const sx = stageX + dx, sy = stageY + dy;
      if (sx >= 2 && sx < W - 2 && sy >= 2 && sy < H - 2) {
        worldMap[sy][sx] = 19; // plaza tile (stage)
      }
    }
  }

  // Festival vendor stalls (buildings)
  worldMap[stageY - 3][stageX - 1] = 5; // food stall
  worldMap[stageY - 3][stageX + 2] = 5; // games stall
  worldMap[stageY + 4][stageX] = 5;     // craft stall
  worldMap[stageY + 4][stageX + 3] = 5; // prize stall

  // Open lawn for events (keep center clear, scatter flowers)
  for (let y = 60; y < 74; y++) {
    for (let x = 10; x < 28; x++) {
      if (worldMap[y][x] === 9 && _rhHash(x * 5, y * 9) % 8 === 0) {
        worldMap[y][x] = 10;
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // FARMLAND — scattered farms between areas
  // ═══════════════════════════════════════════════════

  // Farm cluster 1: northwest of Meadowbrook (small homestead)
  const farm1X = 12, farm1Y = 38;
  worldMap[farm1Y][farm1X] = 5;         // farmhouse
  worldMap[farm1Y][farm1X + 2] = 5;     // barn
  worldMap[farm1Y + 2][farm1X + 1] = 8; // workbench
  // Crop fields (flower tiles in rows = planted fields)
  for (let y = farm1Y + 3; y < farm1Y + 7; y++) {
    for (let x = farm1X - 1; x < farm1X + 4; x++) {
      if (x >= 2 && y < H - 2 && worldMap[y][x] === 9) worldMap[y][x] = 10;
    }
  }
  // Path to farm
  for (let x = farm1X + 4; x < 20; x++) {
    if (worldMap[farm1Y + 1][x] === 9) worldMap[farm1Y + 1][x] = 2;
  }

  // Farm cluster 2: south of Windmill Ridge
  const farm2X = 48, farm2Y = 24;
  worldMap[farm2Y][farm2X] = 5;
  worldMap[farm2Y + 2][farm2X - 1] = 5;
  // Fenced crop area (flowers)
  for (let y = farm2Y + 1; y < farm2Y + 4; y++) {
    for (let x = farm2X + 1; x < farm2X + 5; x++) {
      if (x < W - 2 && y < H - 2 && worldMap[y][x] === 9) worldMap[y][x] = 10;
    }
  }

  // ═══════════════════════════════════════════════════
  // ROLLING HILLS TERRAIN — scattered mounds across open areas
  // ═══════════════════════════════════════════════════
  // Add rolling terrain everywhere that's still plain grass
  for (let y = 3; y < H - 3; y++) {
    for (let x = 3; x < W - 3; x++) {
      if (worldMap[y][x] !== 9) continue;
      const hillN = _rhTerrainNoise(x, y, 190);
      if (hillN > 0.73) {
        worldMap[y][x] = 11; // rolling_hill
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // ADDITIONAL FLOWER FIELDS — make open areas lush
  // ═══════════════════════════════════════════════════
  // Southern meadow (between Festival Grounds and Swamp Farm)
  for (let y = 50; y < 58; y++) {
    for (let x = 3; x < 55; x++) {
      if (worldMap[y][x] !== 9) continue;
      const flN = _rhTerrainNoise(x, y, 270);
      if (flN > 0.62) worldMap[y][x] = 10;
    }
  }

  // Wildflower trail along the western edge
  for (let y = 30; y < 58; y++) {
    for (let x = 3; x < 12; x++) {
      if (worldMap[y][x] === 9 && _rhHash(x * 13, y * 17) % 5 < 2) {
        worldMap[y][x] = 10;
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // PATH NETWORK — connect all areas
  // ═══════════════════════════════════════════════════

  // Main east-west road through the center (y ~42, connecting Meadowbrook to everything)
  for (let x = 3; x < W - 3; x++) {
    const roadY = 42 + Math.floor(Math.sin(x * 0.06) * 1.5);
    if (roadY >= 2 && roadY < H - 2) {
      if (worldMap[roadY][x] !== 3 && worldMap[roadY][x] !== 7) worldMap[roadY][x] = 2;
      if (roadY + 1 < H - 2 && worldMap[roadY + 1][x] !== 3 && worldMap[roadY + 1][x] !== 7) worldMap[roadY + 1][x] = 2;
    }
  }

  // North-south road from Windmill Ridge down to Festival Grounds
  for (let y = 5; y < 72; y++) {
    const roadX = 20 + Math.floor(Math.sin(y * 0.07) * 2);
    if (roadX >= 2 && roadX < W - 2) {
      if (worldMap[y][roadX] !== 3 && worldMap[y][roadX] !== 7) worldMap[y][roadX] = 2;
      if (roadX + 1 < W - 2 && worldMap[y][roadX + 1] !== 3 && worldMap[y][roadX + 1] !== 7) worldMap[y][roadX + 1] = 2;
    }
  }

  // Path from Meadowbrook east into Timber's Woods
  for (let x = mbX + 9; x < 68; x++) {
    const py = 42 + Math.floor(Math.sin(x * 0.15) * 1);
    if (py >= 2 && py < H - 2 && x < W - 2) {
      if (worldMap[py][x] !== 3) worldMap[py][x] = 2;
    }
  }

  // Path from Meadowbrook south to Festival Grounds
  for (let y = mbY + 8; y < 60; y++) {
    const px = 48 - Math.floor((y - mbY - 8) * 1.5);
    if (px >= 2 && px < W - 2 && y < H - 2) {
      if (worldMap[y][px] !== 3 && worldMap[y][px] !== 7) worldMap[y][px] = 2;
    }
  }
  // Continue to festival stage
  for (let x = 22; x < 36; x++) {
    if (worldMap[65][x] !== 3) worldMap[65][x] = 2;
  }

  // Path from Meadowbrook southeast to Swamp Farm
  for (let i = 0; i < 30; i++) {
    const px = mbX + 2 + Math.floor(i * 0.7);
    const py = mbY + 6 + Math.floor(i * 0.6);
    if (px >= 2 && px < W - 2 && py >= 2 && py < H - 2) {
      if (worldMap[py][px] !== 3) worldMap[py][px] = 2;
    }
  }

  // Road along river's east bank (connects fishing spots)
  for (let y = 5; y < H - 4; y++) {
    const riverCX = 39 + Math.floor(Math.sin(y * 0.08) * 4 + Math.sin(y * 0.17 + 1.2) * 2.5 + Math.sin(y * 0.31 + 3.0) * 1.2);
    const baseWidth = y < 15 ? 2 : y < 40 ? 3 : 4;
    const halfW = Math.floor(baseWidth / 2);
    const pathX = riverCX + halfW + 2;
    if (pathX >= 2 && pathX < W - 2 && worldMap[y][pathX] !== 3) {
      worldMap[y][pathX] = 2;
    }
  }

  // ═══════════════════════════════════════════════════
  // ZONE ENTRY/EXIT POINTS (mountain gaps)
  // ═══════════════════════════════════════════════════
  // North passage (from Frost Valley) — center-top
  for (let x = 27; x <= 32; x++) {
    worldMap[0][x] = 2; worldMap[1][x] = 2;
  }
  // South passage (to another zone) — center-bottom
  for (let x = 27; x <= 32; x++) {
    worldMap[H - 1][x] = 2; worldMap[H - 2][x] = 2;
  }
  // East passage (to Volcanic Isles/Timber's Woods exit) — right side
  for (let y = 20; y <= 24; y++) {
    worldMap[y][W - 1] = 2; worldMap[y][W - 2] = 2;
  }
  // West passage — left side
  for (let y = 40; y <= 44; y++) {
    worldMap[y][0] = 2; worldMap[y][1] = 2;
  }

  // ═══════════════════════════════════════════════════
  // ENCOUNTER ZONES (invisible, for spawning logic)
  // ═══════════════════════════════════════════════════
  // These don't paint the map but define encounter areas
  // (The ENCOUNTER_ZONES array in world-gen.js handles this)

  // ═══════════════════════════════════════════════════
  // FINAL PASS: Clear trees from paths and buildings
  // ═══════════════════════════════════════════════════
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = worldMap[y][x];
      if (t === 2 || t === 5 || t === 8 || t === 12 || t === 19) {
        // Clear adjacent trees for breathing room
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
              if (worldMap[ny][nx] === 13) worldMap[ny][nx] = 9; // warm_tree -> grass
            }
          }
        }
      }
    }
  }

  return worldMap;
}
