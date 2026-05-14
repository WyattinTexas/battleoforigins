// ═══════════════════════════════════════════════════════════════
// DUNGEON SCENE — Shared scene for ALL dungeons.
// Reads a config from DUNGEONS (dungeon-configs.js) and runs the dungeon.
// Architecture: each system is a separate small block so you can change
// one (e.g. KO modal, room-clear rules) without touching the others.
//
// Systems:
//   _buildMap()         — parse mapAscii into a tile grid, render once
//   _spawnPlayer()      — place player at entry, camera follow
//   _spawnEnemies()     — create mob + boss sprites from config
//   _handleMovement()   — WASD + wall/door collision
//   _checkAggro()       — walk into mob -> launch battle
//   _onBattleEnd()      — react to win (defeat mob, heal, open doors) / loss (KO)
//   _showKOModal()      — KO'd avatar overlay + "Leave Dungeon" button
//   _spawnStaircase()   — appears after boss dies
//   _exitDungeon()      — fade back to overworld entry, apply gold loss
// ═══════════════════════════════════════════════════════════════

class DungeonScene extends Phaser.Scene {
  constructor() { super('DungeonScene'); }

  init(data) {
    this.dungeonId = data.dungeonId;
    this.config = getDungeonConfig(this.dungeonId);
    this.returnX = data.returnX; // overworld pixel coords to drop the player at on exit
    this.returnY = data.returnY;
  }

  create() {
    if (!this.config) {
      console.error('[DungeonScene] No config; bailing back to overworld.');
      this._exitDungeon({ reason: 'bug' });
      return;
    }

    this.T = 32; // tile size in px

    // Mark the player as inside a dungeon so WorldScene's global BLACKOUT
    // hub-teleport doesn't fire here. Cleared in _exitDungeon.
    G.inDungeon = true;

    // Parse map and runtime state
    this._parseMap();
    this._state = {
      defeatedMobs: new Set(),  // mobIds
      bossDefeated: false,
      doorsOpen: new Set(),     // door indices that have opened
      koActive: false,          // is the player currently in the KO modal?
    };

    // Camera background
    this.cameras.main.setBackgroundColor(this.config.palette.bg);

    this._buildMap();
    this._spawnEnemies();
    this._spawnPlayer();
    this._setupInput();
    this._setupHUD();
    this._buildLighting();
    this._setupResumeHandler();

    // Hide overworld DOM HUD (chat input etc.)
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = 'none';

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════
  //  MAP PARSING + RENDERING
  // ═══════════════════════════════════════════════════════════
  _parseMap() {
    const ascii = this.config.mapAscii;
    this.mapH = ascii.length;
    this.mapW = ascii[0].length;
    this.grid = []; // grid[y][x] = D_TILE value
    this.entry = null;
    this.stairsSlot = null;

    for (let y = 0; y < this.mapH; y++) {
      this.grid[y] = [];
      const row = ascii[y];
      for (let x = 0; x < this.mapW; x++) {
        const ch = row[x] || '#';
        let t = D_TILE.WALL;
        if (ch === '.') t = D_TILE.FLOOR;
        else if (ch === '#') t = D_TILE.WALL;
        else if (ch === '|') t = D_TILE.DOOR_CLOSED;
        else if (ch === 'E') { t = D_TILE.FLOOR; this.entry = { x, y }; }
        else if (ch === 'S') { t = D_TILE.FLOOR; this.stairsSlot = { x, y }; }
        this.grid[y][x] = t;
      }
    }
  }

  _buildMap() {
    const T = this.T;
    const p = this.config.palette;
    // Graphics object for wall edge highlights/shadows drawn over sprites.
    const g = this.add.graphics().setDepth(2);
    this._mapGfx = g;

    // ── Floors ─ flagstone sprite tiles, chosen deterministically.
    // We draw floors under door tiles too so the open-door state
    // reveals a real floor instead of a black hole.
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const t = this.grid[y][x];
        if (t === D_TILE.WALL) continue;
        this._drawFloorTile(g, x, y);
      }
    }

    // ── Walls ─ dark rock sprite + code-drawn highlight on the
    // edge facing the room. Light comes "from above", so every
    // wall's TOP edge gets the lit strip and bottom gets a shadow
    // strip that bleeds into the floor below.
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        if (this.grid[y][x] === D_TILE.WALL) this._drawWallTile(g, x, y);
      }
    }

    // ── Physics colliders for every impassable tile ─────────
    this._wallGroup = this.physics.add.staticGroup();
    this._doorBodies = {};   // collider rect per door
    this._doorSprites = {};  // visual halves per door (for open animation)

    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const t = this.grid[y][x];
        if (!D_IMPASSABLE.has(t)) continue;
        const rect = this.add.rectangle(x * T + T / 2, y * T + T / 2, T, T, 0x000000, 0);
        this.physics.add.existing(rect, true);
        this._wallGroup.add(rect);
        if (t === D_TILE.DOOR_CLOSED) {
          // Draw an icy-stone door frame first
          this._drawDoorFrame(g, x, y);
          this._doorBodies[`${x},${y}`] = rect;
          // Spawn the two wooden door halves on top
          const cx = x * T + T / 2;
          const cy = y * T + T / 2;
          const halfW = 16;
          const leftKey = this.textures.exists('door_l') ? 'door_l' : null;
          const rightKey = this.textures.exists('door_r') ? 'door_r' : null;
          if (leftKey && rightKey) {
            const left  = this.add.image(cx - halfW / 2, cy, leftKey).setDepth(3);
            const right = this.add.image(cx + halfW / 2, cy, rightKey).setDepth(3);
            this._doorSprites[`${x},${y}`] = { left, right };
          }
        }
      }
    }

    // Decorative wall torches inside each room
    this._spawnRoomTorches();

    this.cameras.main.setBounds(0, 0, this.mapW * T, this.mapH * T);
  }

  // ───────────────────────────────────────────────────────────
  //  Deterministic per-tile hash — same dungeon looks the same
  //  on every load.
  // ───────────────────────────────────────────────────────────
  _tileHash(x, y) {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  _hashFloat(x, y, salt) {
    return (this._tileHash(x + (salt|0) * 7919, y + (salt|0) * 104729) & 0xffff) / 0xffff;
  }

  // ───────────────────────────────────────────────────────────
  //  FLOOR — placed as one of 5 hand-designed flagstone sprites,
  //  chosen deterministically per tile so the dungeon looks the
  //  same every load. Falls back to flat fill if textures missing.
  // ───────────────────────────────────────────────────────────
  _drawFloorTile(g, x, y) {
    const T = this.T;
    const tx = x * T, ty = y * T;
    const h = this._tileHash(x, y);
    const variant = 1 + (h % 5);
    const key = `d_floor_${variant}`;
    if (this.textures.exists(key)) {
      this.add.image(tx, ty, key).setOrigin(0, 0).setDepth(0);
    } else {
      g.fillStyle(this.config.palette.floor, 1);
      g.fillRect(tx, ty, T, T);
    }
  }

  // ───────────────────────────────────────────────────────────
  //  WALL — picks a hand-pixeled sprite based on which neighbors
  //  are floor. Closed doors are treated as walls so walls beside
  //  a door read as a continuous edge.
  // ───────────────────────────────────────────────────────────
  _drawWallTile(g, x, y) {
    const T = this.T;
    const tx = x * T, ty = y * T;
    const h = this._tileHash(x, y);

    const isFloor = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= this.mapW || ny >= this.mapH) return false;
      const t = this.grid[ny][nx];
      // DOOR_CLOSED reads as wall for adjacency so the surrounding wall
      // sprite stays consistent. DOOR_OPEN and STAIRS read as floor.
      return t === D_TILE.FLOOR || t === D_TILE.DOOR_OPEN || t === D_TILE.STAIRS;
    };
    const inS = isFloor(x, y + 1);
    const inN = isFloor(x, y - 1);
    const inE = isFloor(x + 1, y);
    const inW = isFloor(x - 1, y);

    // Resolve sprite key based on adjacency
    let baseKey = null;
    let variantCount = 1;
    const floorCount = (inS ? 1 : 0) + (inN ? 1 : 0) + (inE ? 1 : 0) + (inW ? 1 : 0);

    if (floorCount === 1) {
      if (inS)      { baseKey = 'd_wall_top';    variantCount = 3; }
      else if (inN) { baseKey = 'd_wall_bottom'; variantCount = 2; }
      else if (inE) { baseKey = 'd_wall_left';   variantCount = 2; }
      else          { baseKey = 'd_wall_right';  variantCount = 2; }
    } else if (floorCount === 2) {
      if      (inS && inE) baseKey = 'd_wall_corner_se';
      else if (inS && inW) baseKey = 'd_wall_corner_sw';
      else if (inN && inE) baseKey = 'd_wall_corner_ne';
      else if (inN && inW) baseKey = 'd_wall_corner_nw';
      else if (inN && inS) { baseKey = 'd_wall_hdiv'; variantCount = 2; }
      // E+W (vertical divider) — fallback to interior, rare in this map
    }
    if (!baseKey) { baseKey = 'd_wall_interior'; variantCount = 2; }

    const variant = 1 + (h % variantCount);
    const fullKey = variantCount > 1 ? `${baseKey}_${variant}` : baseKey;

    if (this.textures.exists(fullKey)) {
      this.add.image(tx, ty, fullKey).setOrigin(0, 0).setDepth(1);
    } else {
      g.fillStyle(0x2a3848, 1);
      g.fillRect(tx, ty, T, T);
    }
  }

  // ───────────────────────────────────────────────────────────
  //  DOOR FRAME — stone arch around the doorway. Only the FRAME
  //  edges are drawn; the center is intentionally left clear so
  //  the floor sprite below shows through. When the door opens,
  //  the wood halves slide aside and the floor is visible — looks
  //  like a real passageway, not a black hole.
  // ───────────────────────────────────────────────────────────
  _drawDoorFrame(g, x, y) {
    const T = this.T;
    const tx = x * T, ty = y * T;
    const FRAME       = 0x5a4838;
    const FRAME_LIGHT = 0x7a6048;
    const FRAME_DARK  = 0x2a1c12;
    // Top rail (lintel)
    g.fillStyle(FRAME_DARK, 1); g.fillRect(tx,     ty + 2, T, 5);
    g.fillStyle(FRAME, 1);      g.fillRect(tx + 1, ty + 3, T - 2, 3);
    g.fillStyle(FRAME_LIGHT, 1);g.fillRect(tx + 2, ty + 3, T - 4, 1);
    // Bottom rail (sill)
    g.fillStyle(FRAME_DARK, 1); g.fillRect(tx,     ty + T - 5, T, 4);
    g.fillStyle(FRAME, 1);      g.fillRect(tx + 1, ty + T - 4, T - 2, 2);
    // Left jamb
    g.fillStyle(FRAME_DARK, 1); g.fillRect(tx,     ty + 7, 3, T - 14);
    g.fillStyle(FRAME, 1);      g.fillRect(tx + 1, ty + 7, 1, T - 14);
    // Right jamb
    g.fillStyle(FRAME_DARK, 1); g.fillRect(tx + T - 3, ty + 7, 3, T - 14);
    g.fillStyle(FRAME, 1);      g.fillRect(tx + T - 2, ty + 7, 1, T - 14);
    // Center deliberately left clear — floor sprite below shows through.
  }

  // ───────────────────────────────────────────────────────────
  //  WALL TORCHES — one on each side wall of every room
  // ───────────────────────────────────────────────────────────
  _spawnRoomTorches() {
    const T = this.T;
    for (const room of this.config.rooms) {
      const midY = Math.floor((room.yMin + room.yMax) / 2);
      // Inside edge of left wall — east-facing torch
      this._drawWallTorch((room.xMin - 1) * T + T - 3, midY * T + T / 2);
      // Inside edge of right wall — west-facing torch
      this._drawWallTorch((room.xMax + 1) * T + 3, midY * T + T / 2);
    }
  }

  _drawWallTorch(px, py) {
    const L = this.config.lighting || {};
    const haloR = L.torchLightRadius || 80;
    const haloA = L.torchLightAlpha || 0.42;

    // Iron bracket — bigger, more visible
    const bracket = this.add.graphics().setDepth(6);
    bracket.fillStyle(0x1a1218, 1);
    bracket.fillRect(px - 2, py + 2, 4, 8);          // back plate
    bracket.fillStyle(0x3a2818, 1);
    bracket.fillRect(px - 1, py - 1, 3, 10);         // pole
    bracket.fillStyle(0x6a5040, 1);
    bracket.fillRect(px,     py - 1, 1, 8);
    // Torch holder cup
    bracket.fillStyle(0x2a1818, 1);
    bracket.fillRect(px - 3, py - 4, 7, 3);
    bracket.fillStyle(0x4a3020, 1);
    bracket.fillRect(px - 2, py - 4, 5, 1);

    // Flame — larger, three-color tiered with bigger flicker
    const flame = this.add.graphics().setDepth(7);
    const drawFlame = (big) => {
      flame.clear();
      const fx = px + 0.5, fy = py - 8;
      // Outer orange
      flame.fillStyle(0xff6622, 0.95);
      flame.fillCircle(fx, fy, big ? 6 : 5);
      // Middle yellow
      flame.fillStyle(0xffaa33, 1);
      flame.fillCircle(fx, fy - 1, big ? 4 : 3);
      // Inner bright
      flame.fillStyle(0xffdd66, 1);
      flame.fillCircle(fx, fy - 1, big ? 2.5 : 2);
      // White core
      flame.fillStyle(0xfff2c0, 1);
      flame.fillCircle(fx, fy - 1, 1);
    };
    drawFlame(true);

    // Light halo — soft warm pool. Sits ABOVE the vignette so it
    // visibly punches through the darkness.
    const halo = this.add.circle(px, py - 8, haloR, 0xff9944, haloA).setDepth(20);
    // Inner brighter core
    const haloCore = this.add.circle(px, py - 8, haloR * 0.45, 0xffcc66, haloA * 0.55).setDepth(20);

    let big = true;
    this.time.addEvent({
      delay: 160, loop: true,
      callback: () => { big = !big; drawFlame(big); },
    });
    this.tweens.add({ targets: [halo, haloCore], alpha: '-=0.15', scaleX: 1.1, scaleY: 1.1,
      duration: 350, yoyo: true, repeat: -1 });
  }

  // ───────────────────────────────────────────────────────────
  //  LIGHTING / VIGNETTE — toggle and tune via config.lighting.
  //  Set enabled:false to disable the whole effect.
  // ───────────────────────────────────────────────────────────
  _buildLighting() {
    const L = this.config.lighting;
    if (!L || !L.enabled) return;
    const cam = this.cameras.main;

    // Ambient blue cast — slight world-wide tint making things feel cold
    if (L.ambientTintAlpha > 0 && L.ambientTint != null) {
      const tint = this.add.rectangle(
        cam.width / 2, cam.height / 2, cam.width, cam.height,
        L.ambientTint, L.ambientTintAlpha
      ).setScrollFactor(0).setDepth(15);
      this._lightingTint = tint;
    }

    // Vignette overlay — darker at corners, transparent center.
    if (L.vignetteAlpha > 0 && this.textures.exists('d_vignette')) {
      const vig = this.add.image(cam.width / 2, cam.height / 2, 'd_vignette')
        .setScrollFactor(0)
        .setDepth(18)
        .setAlpha(L.vignetteAlpha);
      vig.setDisplaySize(cam.width, cam.height);
      this._lightingVignette = vig;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  ENEMY SPAWNS (mobs + boss) — uses card art when available
  // ═══════════════════════════════════════════════════════════
  _spawnEnemies() {
    this.enemies = []; // unified list: { mobId/bossId, isBoss, sprite, label, cardId, x, y, room, defeated }

    const makeEnemy = (def, isBoss) => {
      const card = (typeof ALL_CARDS !== 'undefined') ? ALL_CARDS.find(c => c.id === def.cardId) : null;
      const name = card ? card.name : '???';
      const T = this.T;
      const cx = def.x * T + T / 2;
      const cy = def.y * T + T / 2;

      // Visual: world-style creature sprite (16x16, scaled up like overworld NPCs).
      // Falls back to a tinted rect if the texture didn't load.
      const skey = def.spriteKey || (isBoss ? 'creature_dragon' : 'enemy_sprite');
      let sprite;
      if (this.textures.exists(skey)) {
        sprite = this.add.sprite(cx, cy, skey, 0).setScale(isBoss ? 3 : 2.2).setDepth(8);
      } else {
        sprite = this.add.rectangle(cx, cy, isBoss ? 56 : 40, isBoss ? 56 : 40,
          isBoss ? 0xcc2244 : 0x7777aa, 0.95).setStrokeStyle(2, 0xffffff).setDepth(8);
      }

      const labelColor = isBoss ? '#ff8844' : '#ffcc88';
      const label = this.add.text(cx, cy - (isBoss ? 38 : 28),
        isBoss ? `${name.toUpperCase()} — BOSS` : name, {
          fontSize: isBoss ? '11px' : '9px',
          fontFamily: 'monospace', fontStyle: 'bold', color: labelColor,
          backgroundColor: '#00000099', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(9);

      // Subtle pulse for the boss so it reads as important
      if (isBoss) {
        this.tweens.add({ targets: sprite, scaleX: '+=0.06', scaleY: '+=0.06',
          duration: 900, yoyo: true, repeat: -1 });
      }

      return {
        id: isBoss ? def.bossId : def.mobId, isBoss,
        cardId: def.cardId, name, room: def.room,
        x: def.x, y: def.y, cx, cy,
        sprite, label, defeated: false,
      };
    };

    for (const m of this.config.mobs) this.enemies.push(makeEnemy(m, false));
    this.enemies.push(makeEnemy(this.config.boss, true));
  }

  // ═══════════════════════════════════════════════════════════
  //  PLAYER SPAWN + CAMERA
  // ═══════════════════════════════════════════════════════════
  _spawnPlayer() {
    const T = this.T;
    const spawnPX = this.entry.x * T + T / 2;
    const spawnPY = this.entry.y * T + T / 2;

    const tex = (G.spriteKey && this.textures.exists(G.spriteKey)) ? G.spriteKey : 'player';
    this.player = this.physics.add.sprite(spawnPX, spawnPY, tex, 0);
    this.player.setScale(2).setDepth(10).setCollideWorldBounds(true);
    // Shrink physics body so player can fit through tile-wide doorways
    // without their sprite edges catching wall colliders.
    if (this.player.body && this.player.body.setSize) {
      this.player.body.setSize(10, 10);
      this.player.body.setOffset(3, 5);
    }
    // Real Phaser collision against wall + closed-door static bodies.
    if (this._wallGroup) this.physics.add.collider(this.player, this._wallGroup);

    // Pulsing marker so you always find yourself
    this._marker = this.add.circle(spawnPX, spawnPY, 24, 0x88ccff, 0.4).setDepth(9);
    this.tweens.add({ targets: this._marker, scaleX: 1.4, scaleY: 1.4, alpha: 0.1,
      duration: 1000, yoyo: false, repeat: -1 });

    const cam = this.cameras.main;
    cam.setZoom(1.6);
    cam.setScroll(spawnPX - cam.width / (2 * cam.zoom), spawnPY - cam.height / (2 * cam.zoom));
    cam.startFollow(this.player, true, 1, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  INPUT
  // ═══════════════════════════════════════════════════════════
  _setupInput() {
    this.keys = this.input.keyboard.addKeys({
      W: 'W', A: 'A', S: 'S', D: 'D',
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      E: 'E',
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  HUD — dungeon name + room progress + exit hint
  // ═══════════════════════════════════════════════════════════
  _setupHUD() {
    this._titleText = this.add.text(this.scale.width / 2, 10, this.config.name.toUpperCase(), {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#bfe4ff',
      backgroundColor: '#000000cc', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);

    this._hintText = this.add.text(10, this.scale.height - 20,
      'WASD: Move  |  Walk into enemy: Fight  |  ESC: Leave dungeon (-' + this.config.goldLossOnFail + 'g)', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaaacc',
    }).setScrollFactor(0).setDepth(200);

    // ESC key for voluntary exit
    this.escKey = this.input.keyboard.addKey('ESC');
  }

  // ═══════════════════════════════════════════════════════════
  //  BATTLE RESUME HANDLER — fires when BattleScene returns
  // ═══════════════════════════════════════════════════════════
  _setupResumeHandler() {
    this.events.on('resume', () => {
      console.log('[Dungeon] scene resumed, pendingEnemy=', this._pendingEnemy?.name || 'NONE');
      if (!this._pendingEnemy) return;
      const enemy = this._pendingEnemy;
      this._pendingEnemy = null;

      const playerWiped = !G.team.some(g => !g.ko && g.hp > 0);
      console.log('[Dungeon] battle resolved. playerWiped=', playerWiped, '| enemy:', enemy.name, '| room:', enemy.room);
      if (playerWiped) {
        this._onBattleLoss(enemy);
      } else {
        this._onBattleWin(enemy);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  MAIN UPDATE LOOP
  // ═══════════════════════════════════════════════════════════
  update() {
    if (G.inBattle) return;       // battle in progress — pause world updates
    if (this._state.koActive) return; // KO modal up — block movement

    this._handleMovement();
    this._checkAggro();
    this._checkStaircase();

    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this._confirmEscape();
    }

    // Keep marker on player
    if (this._marker && this.player) {
      this._marker.setPosition(this.player.x, this.player.y);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  MOVEMENT — WASD/arrows. Wall + door collision is handled by
  //  Phaser's static-body collider registered in _buildMap(); we
  //  just set the velocity and let physics resolve overlaps.
  // ═══════════════════════════════════════════════════════════
  _handleMovement() {
    const speed = 160;
    let vx = 0, vy = 0;
    const k = this.keys;
    if (k.A.isDown || k.left.isDown)  vx = -speed;
    if (k.D.isDown || k.right.isDown) vx =  speed;
    if (k.W.isDown || k.up.isDown)    vy = -speed;
    if (k.S.isDown || k.down.isDown)  vy =  speed;
    // Normalize diagonal so diagonal isn't faster than cardinal
    if (vx && vy) { vx *= 0.707; vy *= 0.707; }

    this.player.setVelocity(vx, vy);

    // Walk anim
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const tex = this.player.texture.key;
      const prefix = (tex === 'player') ? '' : tex + '_';
      const dir = Math.abs(vx) > Math.abs(vy)
        ? (vx > 0 ? 'walk_right' : 'walk_left')
        : (vy > 0 ? 'walk_down' : 'walk_up');
      try { this.player.anims.play(prefix + dir, true); } catch(e) {}
    } else {
      this.player.anims && this.player.anims.stop();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  AGGRO — walking into a mob triggers a battle
  // ═══════════════════════════════════════════════════════════
  _checkAggro() {
    if (!this.config.aggroOnContact) return;
    for (const e of this.enemies) {
      if (e.defeated) continue;
      const dx = this.player.x - e.cx;
      const dy = this.player.y - e.cy;
      const r = e.isBoss ? 30 : 26;
      if (dx * dx + dy * dy < r * r) {
        // Test mode: skip the battle entirely and instantly defeat the
        // mob. Useful for verifying victory-exit flow end-to-end without
        // dice variance. Toggle off in dungeon config for real play.
        if (this.config.instaWin) {
          console.log('[Dungeon] instaWin: skipping battle vs', e.name);
          this._onBattleWin(e);
          return;
        }
        this._launchBattle(e);
        return;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  STAIRCASE — only appears after boss defeat; step on it = exit
  // ═══════════════════════════════════════════════════════════
  _checkStaircase() {
    if (!this._state.bossDefeated || !this.stairsSlot) return;
    const sx = this.stairsSlot.x * this.T + this.T / 2;
    const sy = this.stairsSlot.y * this.T + this.T / 2;
    const dx = this.player.x - sx;
    const dy = this.player.y - sy;
    if (dx * dx + dy * dy < 24 * 24) {
      this._exitDungeon({ reason: 'victory' });
    }
  }

  _spawnStaircase() {
    if (!this.stairsSlot) return;
    const T = this.T;
    const tileX = this.stairsSlot.x * T;
    const tileY = this.stairsSlot.y * T;
    const cx = tileX + T / 2;
    const cy = tileY + T / 2;
    this.grid[this.stairsSlot.y][this.stairsSlot.x] = D_TILE.STAIRS;

    // Visual is centered on the tile but overflows ~4px on each side so the
    // doorway has presence; trigger zone is still the underlying tile.
    const vw = 40, vh = 38;
    const vx = cx - vw / 2;
    const vy = cy - vh / 2;

    // ── Doorway frame (icy stone) ───────────────────────────
    const FRAME_DARK  = 0x3a4858;
    const FRAME       = 0x6a8090;
    const FRAME_LIGHT = 0xb0c4d4;
    const DARK        = 0x141a26;
    const TREAD_LIGHT = 0xd8e8f0;
    const TREAD_MID   = 0xa0bccc;
    const TREAD_DARK  = 0x6a88a0;
    const STEP_GAP    = 0x2a3848;

    const g = this.add.graphics().setDepth(3);

    // Frame outer (with rounded top corners for smoother feel)
    g.fillStyle(FRAME_DARK, 1);
    g.fillRoundedRect(vx, vy, vw, vh - 2, { tl: 4, tr: 4, bl: 0, br: 0 });
    // Frame inner shoulder
    g.fillStyle(FRAME, 1);
    g.fillRoundedRect(vx + 2, vy + 2, vw - 4, vh - 5, { tl: 3, tr: 3, bl: 0, br: 0 });
    // Inner highlight (top edge)
    g.fillStyle(FRAME_LIGHT, 1);
    g.fillRoundedRect(vx + 4, vy + 3, vw - 8, 2, 1);

    // Interior cavity (where the steps live)
    const iw = vw - 12, ih = vh - 10;
    const ix = vx + 6, iy = vy + 6;
    g.fillStyle(DARK, 1);
    g.fillRoundedRect(ix, iy, iw, ih, { tl: 2, tr: 2, bl: 0, br: 0 });

    // ── Step bands inside, ascending into darkness ──────────
    // Closest band at bottom = lightest + widest. Farthest at top = darker.
    const bands = [
      { y: ih - 6,  pad: 2, color: TREAD_LIGHT },
      { y: ih - 12, pad: 3, color: TREAD_MID },
      { y: ih - 18, pad: 4, color: TREAD_DARK },
      { y: ih - 23, pad: 5, color: 0x4a6878 },
    ];
    for (const b of bands) {
      const bw = iw - b.pad * 2;
      const bx = ix + b.pad;
      const by = iy + b.y;
      if (bw <= 0) continue;
      // Tread (with subtle rounded corners)
      g.fillStyle(b.color, 1);
      g.fillRoundedRect(bx, by, bw, 3, 1);
      // Step gap shadow below the tread
      g.fillStyle(STEP_GAP, 1);
      g.fillRect(bx, by + 3, bw, 1);
    }

    // ── Torches flanking the doorway ────────────────────────
    const drawTorch = (px, py) => {
      // Wall bracket
      g.fillStyle(0x4a3828, 1);
      g.fillRect(px - 1, py + 4, 3, 5);
      g.fillStyle(0x6a5040, 1);
      g.fillRect(px, py + 4, 1, 4);
      // Flame body (two-frame flicker via tween below)
      const flame = this.add.graphics().setDepth(4);
      const drawFlame = (tall) => {
        flame.clear();
        // Outer flame (orange)
        flame.fillStyle(0xff7733, 1);
        flame.fillCircle(px + 0.5, py + 1, tall ? 3 : 2.5);
        // Inner flame (yellow)
        flame.fillStyle(0xffcc44, 1);
        flame.fillCircle(px + 0.5, py + 1, tall ? 2 : 1.5);
        // Hot core (white-yellow)
        flame.fillStyle(0xffee99, 1);
        flame.fillCircle(px + 0.5, py + 1, 1);
      };
      drawFlame(true);
      // Soft halo
      const halo = this.add.circle(px + 0.5, py + 1, 7, 0xff9944, 0.18).setDepth(3);
      // Flicker (alternate flame size)
      this.time.addEvent({
        delay: 220, loop: true,
        callback: () => drawFlame(!flame._tall),
      });
      flame._tall = false;
      this.tweens.add({ targets: halo, alpha: 0.08, scaleX: 1.2, scaleY: 1.2,
        duration: 350, yoyo: true, repeat: -1 });
    };

    drawTorch(vx - 1, vy + 4);          // left torch
    drawTorch(vx + vw + 1, vy + 4);     // right torch

    // Subtle inviting glow inside the doorway
    const glow = this.add.circle(cx, iy + 6, 12, 0xbfe4ff, 0.35).setDepth(2);
    this.tweens.add({ targets: glow, scaleX: 1.4, scaleY: 1.4, alpha: 0.12,
      duration: 1600, yoyo: true, repeat: -1 });

    // Hint
    this.add.text(cx, vy + vh + 10, '[Step on stairs to exit]', {
      fontSize: '9px', fontFamily: 'monospace', color: '#bfe4ff',
      backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(11);
  }

  // ═══════════════════════════════════════════════════════════
  //  BATTLE LAUNCH — build enemy team, init engine, scene-launch
  // ═══════════════════════════════════════════════════════════
  _launchBattle(enemy) {
    if (G.inBattle || typeof buildPlayerBattleTeam !== 'function') return;
    if (!G.team.some(g => !g.ko && g.hp > 0)) return;

    const card = ALL_CARDS.find(c => c.id === enemy.cardId);
    if (!card) { console.warn('[Dungeon] missing card for', enemy); return; }

    const mult = enemy.isBoss ? this.config.bossHpMultiplier : this.config.mobHpMultiplier;
    const scaledMaxHp = Math.max(1, Math.round(card.maxHp * mult));

    this._pendingEnemy = enemy;
    G.inBattle = true;
    const playerGhosts = buildPlayerBattleTeam();
    console.log('[Dungeon] launching battle vs', enemy.name, '| player team size:', playerGhosts.length, '| scaled HP:', scaledMaxHp);

    if (typeof initBattle === 'function') {
      initBattle(playerGhosts.map(g => g.id), [card.id], {
        type: 'dungeon', dungeonId: this.dungeonId, bossFight: enemy.isBoss
      });
      // Apply the dungeon-config HP multiplier (initBattle's makeTeam resets
      // HP from the card; mutate B AFTER so the multiplier actually takes effect).
      if (typeof B !== 'undefined' && B && B.blue && B.blue.ghosts && B.blue.ghosts[0]) {
        B.blue.ghosts[0].maxHp = scaledMaxHp;
        B.blue.ghosts[0].hp = scaledMaxHp;
      }
    }

    // Defer launch+pause out of the update tick via delayedCall so
    // Phaser 4 fully initializes BattleScene before this scene pauses.
    // No DungeonScene fadeOut — BattleScene draws an opaque full-screen
    // background, so there is nothing to hide behind a fade.
    this.time.delayedCall(1, () => {
      this.scene.launch('BattleScene', {
        enemyCard: card,
        trainerName: enemy.isBoss ? `${enemy.name.toUpperCase()} (BOSS)` : enemy.name,
        dungeon: true,
        returnScene: 'DungeonScene',
      });
      // Critical: bring BattleScene to top of the render stack. Without
      // this, DungeonScene (declared AFTER BattleScene in config.scene)
      // renders on top and hides BattleScene's UI under its own layer.
      this.scene.bringToTop('BattleScene');
      this.scene.pause();
      console.log('[Dungeon] battle launched, brought to top, scene paused');
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  POST-BATTLE — win or loss
  // ═══════════════════════════════════════════════════════════
  _onBattleWin(enemy) {
    enemy.defeated = true;
    // Remove visuals
    if (enemy.sprite) enemy.sprite.destroy();
    if (enemy.label) enemy.label.destroy();

    // Heal team back to full if config says so (and it wasn't the final boss).
    // Final boss healing is irrelevant since we exit after.
    if (this.config.healBetweenFights && !enemy.isBoss) {
      for (const g of G.team) { if (!g.ko) g.hp = g.maxHp; }
    }

    if (enemy.isBoss) {
      this._state.bossDefeated = true;
      G.coins = (G.coins || 0) + this.config.bossRewardGold;
      this.showNotification(`Final boss defeated! +${this.config.bossRewardGold} gold. Find the staircase to exit.`);
      this._spawnStaircase();
      saveGame();
      return;
    }

    // Non-boss win: check if its room is fully cleared → open the door it gates
    this._checkRoomClear(enemy.room);
    this.showNotification(`Defeated ${enemy.name}!`);
    saveGame();
  }

  _checkRoomClear(roomId) {
    const remaining = this.enemies.filter(e => e.room === roomId && !e.defeated);
    console.log('[Dungeon] _checkRoomClear room=', roomId, '| remaining mobs:', remaining.length,
      '| doors gated by this room:', this.config.doors.filter(d => d.unlockedBy === roomId).length);
    if (remaining.length > 0) return;
    // Open every door gated by this room.
    this.config.doors.forEach((d, i) => {
      if (d.unlockedBy !== roomId) return;
      if (this._state.doorsOpen.has(i)) return;
      this._state.doorsOpen.add(i);
      this.grid[d.y][d.x] = D_TILE.DOOR_OPEN;
      const key = `${d.x},${d.y}`;

      // Destroy collider immediately so the player can already walk through.
      const doorObj = this._doorBodies[key];
      if (doorObj) { doorObj.destroy(); delete this._doorBodies[key]; }

      // Animate the wooden door halves: swing outward + fade. The stone
      // frame painted into mapGfx stays — looks like the door swung open
      // and is now tucked into the wall recess.
      const sprites = this._doorSprites[key];
      if (sprites) {
        this.tweens.add({
          targets: sprites.left, x: sprites.left.x - 14, alpha: 0,
          duration: 550, ease: 'Cubic.easeOut',
          onComplete: () => sprites.left.destroy(),
        });
        this.tweens.add({
          targets: sprites.right, x: sprites.right.x + 14, alpha: 0,
          duration: 550, ease: 'Cubic.easeOut',
          onComplete: () => sprites.right.destroy(),
        });
        delete this._doorSprites[key];
      }

      // Sound stub — a creak/thud would slot in here. Skipped for now.
    });
  }

  _onBattleLoss(enemy) {
    this._showKOModal();
  }

  // ═══════════════════════════════════════════════════════════
  //  KO MODAL — solo flow: lying-down avatar + "Leave Dungeon" button
  //  (Multiplayer rez wires in Commit 2.)
  // ═══════════════════════════════════════════════════════════
  _showKOModal() {
    this._state.koActive = true;

    // Lying-down sprite: rotate the player 90deg, dim the texture, add ZZZ
    if (this.player) {
      this.player.setRotation(Math.PI / 2);
      this.player.setAlpha(0.7);
      this.player.anims && this.player.anims.stop();
    }
    if (this._marker) this._marker.setVisible(false);

    // Floating Z squiggles
    this._koZs = [];
    for (let i = 0; i < 3; i++) {
      const z = this.add.text(this.player.x + (i - 1) * 6, this.player.y - 20 - i * 8, 'z', {
        fontSize: (10 - i * 2) + 'px', fontFamily: 'monospace', fontStyle: 'bold',
        color: '#bfe4ff',
      }).setOrigin(0.5).setDepth(11);
      this.tweens.add({
        targets: z, y: z.y - 14, alpha: 0,
        duration: 2200, delay: i * 400, repeat: -1,
      });
      this._koZs.push(z);
    }

    // Modal box
    const W = this.scale.width, H = this.scale.height;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(220);
    const box = this.add.rectangle(W / 2, H / 2, 380, 200, 0x1a2230, 0.97)
      .setStrokeStyle(2, 0x4488cc).setScrollFactor(0).setDepth(221);
    const title = this.add.text(W / 2, H / 2 - 70, 'YOU WERE DEFEATED', {
      fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ff8888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);
    const body = this.add.text(W / 2, H / 2 - 20,
      `Your team has been knocked out.\n\nLeaving the dungeon will cost you ${this.config.goldLossOnFail} gold.`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#ccddee', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);

    const btnBg = this.add.rectangle(W / 2, H / 2 + 50, 220, 40, 0x884444, 0.95)
      .setStrokeStyle(2, 0xcc6666).setInteractive({ useHandCursor: true })
      .setScrollFactor(0).setDepth(222);
    const btnText = this.add.text(W / 2, H / 2 + 50, `Leave Dungeon  ( -${this.config.goldLossOnFail}g )`, {
      fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(223);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0xaa5555));
    btnBg.on('pointerout',  () => btnBg.setFillStyle(0x884444, 0.95));
    btnBg.on('pointerdown', () => this._exitDungeon({ reason: 'fail' }));

    this._koModal = [overlay, box, title, body, btnBg, btnText];
  }

  // ═══════════════════════════════════════════════════════════
  //  ESC = voluntary exit (still costs gold — leaving counts as failure)
  // ═══════════════════════════════════════════════════════════
  _confirmEscape() {
    if (this._state.koActive) return;
    // Simple confirm using the same modal style
    const W = this.scale.width, H = this.scale.height;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(220);
    const box = this.add.rectangle(W / 2, H / 2, 380, 180, 0x1a2230, 0.97)
      .setStrokeStyle(2, 0x4488cc).setScrollFactor(0).setDepth(221);
    const title = this.add.text(W / 2, H / 2 - 60, 'LEAVE DUNGEON?', {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffcc88',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);
    const body = this.add.text(W / 2, H / 2 - 18,
      `Leaving now will cost you ${this.config.goldLossOnFail} gold.`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#ccddee',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);

    const yesBg = this.add.rectangle(W / 2 - 60, H / 2 + 40, 110, 36, 0x884444, 0.95)
      .setStrokeStyle(1, 0xcc6666).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(222);
    const yesT  = this.add.text(W / 2 - 60, H / 2 + 40, 'Yes (-' + this.config.goldLossOnFail + 'g)', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(223);

    const noBg = this.add.rectangle(W / 2 + 60, H / 2 + 40, 110, 36, 0x336666, 0.95)
      .setStrokeStyle(1, 0x66aaaa).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(222);
    const noT  = this.add.text(W / 2 + 60, H / 2 + 40, 'Stay', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(223);

    const elems = [overlay, box, title, body, yesBg, yesT, noBg, noT];
    const cleanup = () => elems.forEach(e => e.destroy());
    yesBg.on('pointerdown', () => { cleanup(); this._exitDungeon({ reason: 'fail' }); });
    noBg.on('pointerdown',  cleanup);
  }

  // ═══════════════════════════════════════════════════════════
  //  EXIT — fade back to overworld, apply gold loss on failure
  // ═══════════════════════════════════════════════════════════
  _exitDungeon(opts) {
    const reason = (opts && opts.reason) || 'fail';
    if (this._state._exiting) return;
    this._state._exiting = true;

    // Failure tax
    if (reason === 'fail') {
      G.coins = Math.max(0, (G.coins || 0) - this.config.goldLossOnFail);
    }
    G.inBattle = false;
    G.inDungeon = false;
    saveGame();

    // Restore overworld DOM HUD
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = '';

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => {
      // Resolve overworld drop point. Prefer the dungeon's declared
      // `overworldExit` tile (guaranteed walkable, picked when authoring
      // the dungeon) over the raw pixel coords where the player pressed
      // E — those can sit at the edge of an impassable dungeon tile and
      // trip WorldScene's stuck-recovery, which warps the player to the
      // hub. Fall back to returnX/Y only if the config didn't declare.
      const T = 32;
      let exitPx, exitPy;
      if (this.config.overworldExit) {
        exitPx = this.config.overworldExit.x * T + T / 2;
        exitPy = this.config.overworldExit.y * T + T / 2;
      } else if (typeof this.returnX === 'number') {
        exitPx = this.returnX; exitPy = this.returnY;
      }
      // Order matters: resume first (so the scene's update is live),
      // setPosition while DungeonScene still exists (this.scene.get is
      // reliable), then stop DungeonScene last.
      this.scene.resume('WorldScene');
      const ws = this.scene.get('WorldScene');
      if (ws && ws.player && typeof exitPx === 'number') {
        ws.player.setPosition(exitPx, exitPy);
        ws.player.setVelocity && ws.player.setVelocity(0, 0);
        // Sync G so any save/refresh also lands here, not the hub.
        G.x = exitPx / T;
        G.y = exitPy / T;
        saveGame();
        if (ws.cameras && ws.cameras.main) {
          // Snap camera to the player so we don't briefly see the hub.
          const cam = ws.cameras.main;
          cam.centerOn(exitPx, exitPy);
          cam.fadeIn(400, 0, 0, 0);
        }
      }
      if (ws && typeof ws.showNotification === 'function') {
        if (reason === 'victory') ws.showNotification(`${this.config.name} cleared! +${this.config.bossRewardGold} gold.`);
        else ws.showNotification(`Left ${this.config.name}. -${this.config.goldLossOnFail} gold.`);
      }
      this.scene.stop('DungeonScene');
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  Light wrapper around the world's notify (HUD reuse)
  // ═══════════════════════════════════════════════════════════
  showNotification(msg) {
    const t = this.add.text(this.scale.width / 2, 48, msg, {
      fontSize: '12px', fontFamily: 'monospace', color: '#bfe4ff',
      backgroundColor: '#000000cc', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(250);
    this.tweens.add({ targets: t, alpha: 0, y: 30, duration: 2200, delay: 1200,
      onComplete: () => t.destroy() });
  }
}
