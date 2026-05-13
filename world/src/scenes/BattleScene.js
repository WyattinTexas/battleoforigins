// ═══════════════════════════════════════════════════════════════
// BATTLE SCENE — 100% Phaser-Native Rendering
// No DOM overlays. All rendering via Phaser sprites, text, tweens.
// Logic layer untouched: battle-engine, dice-engine, card-abilities,
// willpower, resources all remain pure functions.
// ═══════════════════════════════════════════════════════════════

// ── Layout constants ──────────────────────────────────────────
const BL = {
  W: 1280, H: 720,
  // Column centers
  PX: 210,   // Player column center
  EX: 1070,  // Enemy column center
  CX: 640,   // Center column

  // Vertical positions
  SIDE_Y: 75,
  FIGHT_Y: 290,
  WP_Y: 480,
  DICE_Y: 240,
  RESULT_Y: 350,
  BTN_Y: 430,
  RES_Y: 610,
  LOG_X: 160, LOG_Y: 640,

  // Sizes
  CARD_W: 190, CARD_H: 250,
  SIDE_W: 100, SIDE_H: 120,
  DIE: 44, DIE_GAP: 8,
  BTN_W: 110, BTN_H: 38,
};

// ── Color palette (testroom2 theatre) ─────────────────────────
const BC = {
  BG1: 0x0a0612, BG2: 0x14101e,
  GOLD: '#d4a040', GOLD_HEX: 0xd4a040,
  RED: '#e94560', RED_HEX: 0xe94560,
  BLUE: '#4cc9f0', BLUE_HEX: 0x4cc9f0,
  TEXT: '#f4ecd8', TEXT_DIM: '#6a6056',
  HP_GREEN: '#27ae60', HP_YELLOW: '#f1c40f', HP_RED: '#e74c3c',
  SURFACE: 0x14101c, BORDER: 0x2a2230,
  RARITY: { common: 0x8b95a5, uncommon: 0x2ecc71, rare: 0x3498db, 'ghost-rare': 0x9b59b6, legendary: 0xf39c12 },
  RARITY_STR: { common: '#8b95a5', uncommon: '#2ecc71', rare: '#3498db', 'ghost-rare': '#9b59b6', legendary: '#f39c12' },
};

// ── Text style presets ────────────────────────────────────────
const TS = {
  name:     { fontFamily: 'Cinzel, Georgia, serif', fontSize: '16px', color: BC.TEXT, align: 'center' },
  nameSm:   { fontFamily: 'Cinzel, Georgia, serif', fontSize: '11px', color: BC.TEXT, align: 'center' },
  hp:       { fontFamily: 'Courier New, monospace', fontSize: '13px', color: BC.HP_GREEN, align: 'center' },
  hpSm:     { fontFamily: 'Courier New, monospace', fontSize: '10px', color: BC.HP_GREEN, align: 'center' },
  ability:  { fontFamily: 'Georgia, serif', fontSize: '11px', color: BC.GOLD, align: 'center', wordWrap: { width: 170 } },
  abilDesc: { fontFamily: 'Georgia, serif', fontSize: '9px', color: '#a09686', align: 'center', wordWrap: { width: 170 } },
  dice:     { fontFamily: 'Courier New, monospace', fontSize: '13px', color: BC.TEXT, align: 'center' },
  result:   { fontFamily: 'Cinzel, Georgia, serif', fontSize: '15px', color: BC.GOLD, align: 'center' },
  btn:      { fontFamily: 'Cinzel, Georgia, serif', fontSize: '14px', color: '#fff', align: 'center' },
  log:      { fontFamily: 'Courier New, monospace', fontSize: '10px', color: '#a09686', wordWrap: { width: 280 } },
  logTitle: { fontFamily: 'Cinzel, Georgia, serif', fontSize: '9px', color: BC.GOLD, align: 'center', letterSpacing: 4 },
  callout:  { fontFamily: 'Cinzel, Georgia, serif', fontSize: '48px', color: '#ffd700', align: 'center', stroke: '#000', strokeThickness: 4 },
  callSub:  { fontFamily: 'Georgia, serif', fontSize: '16px', color: BC.TEXT, align: 'center' },
  vs:       { fontFamily: 'Cinzel, Georgia, serif', fontSize: '22px', color: BC.GOLD, align: 'center' },
  res:      { fontFamily: 'Courier New, monospace', fontSize: '11px', color: BC.TEXT, align: 'center' },
  resIcon:  { fontFamily: 'sans-serif', fontSize: '18px', align: 'center' },
  ko:       { fontFamily: 'Cinzel, Georgia, serif', fontSize: '14px', color: '#ff5544', align: 'center' },
  wpCard:   { fontFamily: 'sans-serif', fontSize: '16px', align: 'center' },
  wpLabel:  { fontFamily: 'Courier New, monospace', fontSize: '9px', color: BC.TEXT, align: 'center' },
};

// ── Helper: art path for a ghost ──────────────────────────────
function _artPath(ghost) {
  let url = ghost.art || '';
  if (!url) {
    const slug = (ghost.name || 'unknown').toLowerCase().replace(/\s+/g, '_');
    url = `../testroom/art/originals/${slug}.png`;
  }
  // Resolve relative ../testroom/ paths to absolute for Phaser loader
  if (url.startsWith('../testroom/')) {
    // Works from both localhost and GitHub Pages
    url = 'https://drbango.com/testroom/' + url.slice('../testroom/'.length);
  }
  return url;
}

function _hpColor(hp, max) {
  const pct = hp / max;
  if (pct > 0.5) return BC.HP_GREEN;
  if (pct > 0.25) return BC.HP_YELLOW;
  return BC.HP_RED;
}

function _hpHex(hp, max) {
  const pct = hp / max;
  if (pct > 0.5) return 0x27ae60;
  if (pct > 0.25) return 0xf1c40f;
  return 0xe74c3c;
}

function _rarityHex(r) { return BC.RARITY[(r || 'common').toLowerCase()] || BC.RARITY.common; }
function _rarityStr(r) { return BC.RARITY_STR[(r || 'common').toLowerCase()] || BC.RARITY_STR.common; }

// ── Pip positions for dice (3x3 grid within die) ──────────────
const PIP_POS = {
  1: [[0.5, 0.5]],
  2: [[0.2, 0.2], [0.8, 0.8]],
  3: [[0.2, 0.2], [0.5, 0.5], [0.8, 0.8]],
  4: [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]],
  5: [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]],
  6: [[0.2, 0.2], [0.8, 0.2], [0.2, 0.5], [0.8, 0.5], [0.2, 0.8], [0.8, 0.8]],
};

// ═══════════════════════════════════════════════════════════════
//  THE SCENE
// ═══════════════════════════════════════════════════════════════

class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }

  init(data) {
    this.battleData = data || {};
  }

  create() {
    // Validate battle state
    if (!B) { this._exit(false); return; }

    // Apply buff/fortune effects
    if (typeof applyBuffsToBattle === 'function') applyBuffsToBattle();
    if (typeof applyFortuneToBattle === 'function') applyFortuneToBattle();

    // Team references
    this._pt = 'red';
    this._et = 'blue';
    const pTeam = B[this._pt];
    const eTeam = B[this._et];
    if (!pTeam || !eTeam) { this._exit(false); return; }

    this.pg = activeGhost(pTeam);
    this.eg = activeGhost(eTeam);
    if (!this.pg || !this.eg) { this._exit(false); return; }

    B.battleStarted = true;
    this.roundNum = 0;
    this._rolling = false;
    this._raidId = this.battleData.raidId || null;

    // Hide world HUD during battle
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = 'none';

    // Enrich ghosts with card data
    const enrichGhost = (g) => {
      if (typeof ALL_CARDS !== 'undefined') {
        const card = ALL_CARDS.find(c => c.id === g.id);
        if (card) {
          if (!g.art) g.art = card.art;
          if (!g.abilityDesc && card.desc) g.abilityDesc = card.desc;
          if (!g.ability && card.ability) g.ability = card.ability;
          if (!g.rarity && card.rarity) g.rarity = card.rarity;
        }
      }
      return g;
    };
    pTeam.ghosts.forEach(enrichGhost);
    eTeam.ghosts.forEach(enrichGhost);

    // Log state
    this._logEntries = [];

    // Load card art dynamically, then build stage
    this._loadArt(() => this._buildStage());
  }

  // ── Dynamic art loading ────────────────────────────────────
  _loadArt(onComplete) {
    const allGhosts = [...B[this._pt].ghosts, ...B[this._et].ghosts];
    let toLoad = 0;
    allGhosts.forEach(g => {
      const key = 'ghost_' + g.id;
      if (!this.textures.exists(key)) {
        const url = _artPath(g);
        if (url) { this.load.image(key, url); toLoad++; }
      }
    });
    if (toLoad > 0) {
      this.load.once('complete', onComplete);
      this.load.on('loaderror', (file) => {
        // Silently skip failed loads — we'll show placeholder
      });
      this.load.start();
    } else {
      onComplete();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  BUILD THE STAGE
  // ═══════════════════════════════════════════════════════════

  _buildStage() {
    // ── Responsive: read actual canvas dimensions ──
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    // Override layout constants for this battle based on actual size
    this._W = W;
    this._H = H;
    this._PX = Math.round(W * 0.17);
    this._EX = Math.round(W * 0.83);
    this._CX = Math.round(W * 0.5);
    this._FIGHT_Y = Math.round(H * 0.40);
    this._SIDE_Y = Math.round(H * 0.11);
    this._WP_Y = Math.round(H * 0.68);
    this._RESULT_Y = Math.round(H * 0.50);
    this._BTN_Y = Math.round(H * 0.60);
    this._RES_Y = Math.round(H * 0.85);
    this._LOG_X = Math.round(W * 0.13);
    this._LOG_Y = Math.round(H * 0.90);

    // ── Background ──
    const bg = this.add.graphics();
    bg.fillGradientStyle(BC.BG1, BC.BG1, BC.BG2, BC.BG2, 1);
    bg.fillRect(0, 0, W, H);

    // Subtle vignette overlay
    const vig = this.add.graphics();
    vig.fillStyle(0x000000, 0.3);
    vig.fillRect(0, 0, W, 40);
    vig.fillRect(0, H - 40, W, 40);

    // Gold divider lines
    const lx1 = Math.round(W * 0.32), lx2 = Math.round(W * 0.68);
    const lines = this.add.graphics();
    lines.lineStyle(1, BC.GOLD_HEX, 0.3);
    lines.lineBetween(lx1, 30, lx1, H - 100);
    lines.lineBetween(lx2, 30, lx2, H - 100);
    lines.lineBetween(30, H - 100, W - 30, H - 100);

    // VS text
    this.add.text(this._CX, Math.round(H * 0.06), 'VS', TS.vs).setOrigin(0.5);

    // ── Build elements ──
    this._pCard = this._buildFighterCard(this.pg, 'player', this._PX, this._FIGHT_Y);
    this._eCard = this._buildFighterCard(this.eg, 'enemy', this._EX, this._FIGHT_Y);
    this._pSideline = this._buildSidelineRow('player', this._PX, this._SIDE_Y);
    this._eSideline = this._buildSidelineRow('enemy', this._EX, this._SIDE_Y);

    this._buildDiceArea();
    this._buildButtons();
    this._buildWillpowerDisplays();
    this._buildResourceBar();
    this._buildBattleLog();

    // Fire entry effects
    if (typeof triggerEntry === 'function') {
      const pC = triggerEntry(B[this._pt], this._pt);
      const eC = triggerEntry(B[this._et], this._et);
      [...(pC || []), ...(eC || [])].forEach(c => {
        if (c && c.desc) this._addLog(c.desc, 'ability');
      });
    }

    // Opening log
    const header = this.battleData.trainerName
      ? `${this.battleData.trainerName} challenges you!`
      : `Wild ${this.eg.name} appears!`;
    this._addLog(header, 'system');

    // Fade in
    this.cameras.main.fadeIn(300, 10, 6, 18);
  }

  // ── Fighter Card ───────────────────────────────────────────
  _buildFighterCard(ghost, side, cx, cy) {
    const container = this.add.container(cx, cy);
    const w = BL.CARD_W, h = BL.CARD_H;
    const rarHex = _rarityHex(ghost.rarity);
    const teamHex = side === 'player' ? BC.RED_HEX : BC.BLUE_HEX;

    // Card background
    const cardBg = this.add.graphics();
    cardBg.fillStyle(BC.SURFACE, 0.9);
    cardBg.fillRoundedRect(-w/2, -h/2, w, h, 8);
    cardBg.lineStyle(2, teamHex, 0.8);
    cardBg.strokeRoundedRect(-w/2, -h/2, w, h, 8);
    container.add(cardBg);

    // Rarity accent line at top
    const rarLine = this.add.graphics();
    rarLine.fillStyle(rarHex, 1);
    rarLine.fillRect(-w/2 + 4, -h/2 + 2, w - 8, 3);
    container.add(rarLine);

    // Art image
    const artKey = 'ghost_' + ghost.id;
    const artSize = 140;
    if (this.textures.exists(artKey)) {
      const art = this.add.image(0, -h/2 + 12 + artSize/2, artKey);
      art.setDisplaySize(artSize, artSize);
      container.add(art);
    } else {
      // Placeholder
      const ph = this.add.graphics();
      ph.fillStyle(rarHex, 0.2);
      ph.fillRect(-artSize/2, -h/2 + 12, artSize, artSize);
      container.add(ph);
      const phText = this.add.text(0, -h/2 + 12 + artSize/2, ghost.name.substring(0, 6).toUpperCase(),
        { fontFamily: 'Cinzel, serif', fontSize: '18px', color: _rarityStr(ghost.rarity) }).setOrigin(0.5);
      container.add(phText);
    }

    // Rarity badge
    const rarBadge = this.add.text(-w/2 + 12, -h/2 + 16, (ghost.rarity || 'common').toUpperCase(),
      { fontFamily: 'Courier New, monospace', fontSize: '8px', color: _rarityStr(ghost.rarity),
        backgroundColor: '#0a0612cc', padding: { x: 3, y: 1 } }).setOrigin(0, 0);
    container.add(rarBadge);

    // Name
    const nameText = this.add.text(0, 38, ghost.name, TS.name).setOrigin(0.5);
    container.add(nameText);

    // HP bar background
    const hpBarW = w - 30, hpBarH = 10, hpBarY = 58;
    const hpBg = this.add.graphics();
    hpBg.fillStyle(0x1a1a1a, 1);
    hpBg.fillRoundedRect(-hpBarW/2, hpBarY, hpBarW, hpBarH, 4);
    container.add(hpBg);

    // HP bar fill
    const pct = Math.max(0, ghost.hp / ghost.maxHp);
    const hpFill = this.add.graphics();
    hpFill.fillStyle(_hpHex(ghost.hp, ghost.maxHp), 1);
    hpFill.fillRoundedRect(-hpBarW/2, hpBarY, hpBarW * pct, hpBarH, 4);
    container.add(hpFill);

    // HP text
    const hpText = this.add.text(0, hpBarY + hpBarH + 6,
      `${ghost.hp} / ${ghost.maxHp}`,
      { ...TS.hp, color: _hpColor(ghost.hp, ghost.maxHp) }).setOrigin(0.5);
    container.add(hpText);

    // Ability
    const abilText = this.add.text(0, 90, ghost.ability || '',
      TS.ability).setOrigin(0.5);
    container.add(abilText);

    const descText = this.add.text(0, 108, ghost.abilityDesc || '',
      TS.abilDesc).setOrigin(0.5);
    container.add(descText);

    // Store refs for updates
    container._refs = { hpFill, hpText, hpBg, nameText, abilText, descText, rarBadge, hpBarW, hpBarH, hpBarY };
    return container;
  }

  // ── Update a fighter card from ghost state ─────────────────
  _updateFighterCard(container, ghost) {
    if (!container || !container._refs) return;
    const r = container._refs;
    const pct = Math.max(0, ghost.hp / (ghost.maxHp || 1));

    // Animate HP bar
    r.hpFill.clear();
    r.hpFill.fillStyle(_hpHex(ghost.hp, ghost.maxHp), 1);
    r.hpFill.fillRoundedRect(-r.hpBarW/2, r.hpBarY, r.hpBarW * pct, r.hpBarH, 4);

    r.hpText.setText(`${Math.max(0, ghost.hp)} / ${ghost.maxHp}`);
    r.hpText.setColor(_hpColor(ghost.hp, ghost.maxHp));
    r.nameText.setText(ghost.name);
    r.abilText.setText(ghost.ability || '');
    r.descText.setText(ghost.abilityDesc || '');
  }

  // ── Sideline Row ───────────────────────────────────────────
  _buildSidelineRow(side, cx, cy) {
    const teamKey = side === 'player' ? this._pt : this._et;
    const team = B[teamKey];
    const container = this.add.container(cx, cy);

    const bench = team.ghosts.filter((_, i) => i !== team.activeIdx);
    const startX = -(bench.length - 1) * (BL.SIDE_W + 10) / 2;

    bench.forEach((g, i) => {
      const sx = startX + i * (BL.SIDE_W + 10);
      const card = this._buildSidelineCard(g, side, sx, 0);
      container.add(card);
    });

    container._side = side;
    return container;
  }

  _buildSidelineCard(ghost, side, x, y) {
    const container = this.add.container(x, y);
    const w = BL.SIDE_W, h = BL.SIDE_H;
    const teamHex = side === 'player' ? BC.RED_HEX : BC.BLUE_HEX;
    const isKO = ghost.ko || ghost.hp <= 0;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(BC.SURFACE, isKO ? 0.4 : 0.85);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 6);
    bg.lineStyle(1, isKO ? 0x333333 : teamHex, 0.6);
    bg.strokeRoundedRect(-w/2, -h/2, w, h, 6);
    container.add(bg);

    // Rarity dot
    const rarDot = this.add.graphics();
    rarDot.fillStyle(_rarityHex(ghost.rarity), 1);
    rarDot.fillCircle(-w/2 + 10, -h/2 + 10, 4);
    container.add(rarDot);

    // Art (maintain aspect ratio, crop to fit)
    const artKey = 'ghost_' + ghost.id;
    const artSize = w - 14;
    if (this.textures.exists(artKey)) {
      const art = this.add.image(0, -14, artKey);
      // Scale to fill width while keeping square aspect
      art.setDisplaySize(artSize, artSize);
      if (isKO) art.setTint(0x333333);
      container.add(art);
    }

    // Name
    const name = this.add.text(0, 25, ghost.name, TS.nameSm).setOrigin(0.5);
    if (isKO) name.setAlpha(0.4);
    container.add(name);

    // HP pill
    const hpStr = isKO ? 'KO' : `♥ ${ghost.hp}/${ghost.maxHp}`;
    const hpCol = isKO ? BC.HP_RED : _hpColor(ghost.hp, ghost.maxHp);
    const hp = this.add.text(0, 42, hpStr, { ...TS.hpSm, color: hpCol }).setOrigin(0.5);
    container.add(hp);

    if (isKO) container.setAlpha(0.5);

    return container;
  }

  // ── Rebuild sideline (after swap) ──────────────────────────
  _rebuildSideline(side) {
    const old = side === 'player' ? this._pSideline : this._eSideline;
    if (old) old.destroy();
    const cx = side === 'player' ? (this._PX||BL.PX) : (this._EX||BL.EX);
    const newRow = this._buildSidelineRow(side, cx, (this._SIDE_Y||BL.SIDE_Y));
    if (side === 'player') this._pSideline = newRow;
    else this._eSideline = newRow;
  }

  // ── Dice Area (3D DOM overlay + Phaser result text) ─────
  _buildDiceArea() {
    // Initialize 3D dice system
    if (typeof Dice3D !== 'undefined') Dice3D.init();

    // Result texts (Phaser, below the 3D arena)
    this._pResultText = this.add.text((this._CX||BL.CX) - 120, (this._RESULT_Y||BL.RESULT_Y), '', TS.result).setOrigin(0.5);
    this._eResultText = this.add.text((this._CX||BL.CX) + 120, (this._RESULT_Y||BL.RESULT_Y), '', TS.result).setOrigin(0.5);
  }

  // ── Show dice (3D physics roll → settle to values) ─────────
  _showDice(side, values, isWinner) {
    // 3D dice handle their own display after reveal
    // Just update highlights when called with final winner state
    if (typeof Dice3D !== 'undefined' && isWinner !== false) {
      const team = side === 'player' ? 'red' : 'blue';
      if (isWinner) {
        const res = typeof classify === 'function' ? classify(values) : null;
        if (res) Dice3D.highlightWin(team, res);
      }
    }
  }

  // ── Dice tumble → reveal animation ─────────────────────────
  _tumbleDice(pValues, eValues, callback) {
    if (typeof Dice3D !== 'undefined') {
      // Clear previous dice
      Dice3D.clear('red');
      Dice3D.clear('blue');

      // Launch 3D physics roll
      Dice3D.showRolling('red', pValues.length);
      Dice3D.showRolling('blue', eValues.length);

      // After physics play (800ms), reveal to final values
      this.time.delayedCall(800, () => {
        let revealed = 0;
        const checkDone = () => { revealed++; if (revealed >= 2 && callback) callback(); };
        Dice3D.revealDice('red', pValues, checkDone);
        Dice3D.revealDice('blue', eValues, checkDone);
      });
    } else {
      // Fallback: immediate callback
      if (callback) this.time.delayedCall(500, callback);
    }
  }

  // ── Show roll result text ──────────────────────────────────
  _showRollResult(side, text, isWinner) {
    const txt = side === 'player' ? this._pResultText : this._eResultText;
    txt.setText(isWinner ? text + ' \u2605' : text);
    txt.setColor(isWinner ? '#ffd700' : '#6a6056');

    txt.setScale(0.5);
    this.tweens.add({
      targets: txt,
      scaleX: 1, scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  // ── Buttons ────────────────────────────────────────────────
  _buildButtons() {
    // Fight button
    this._fightBtn = this._makeButton((this._CX||BL.CX) - 60, (this._BTN_Y||BL.BTN_Y), 'FIGHT', BC.RED_HEX, () => this.doRound());
    // Run button
    this._runBtn = this._makeButton((this._CX||BL.CX) + 60, (this._BTN_Y||BL.BTN_Y), 'RUN', 0x444444, () => this._exit(false));
  }

  _makeButton(x, y, label, color, onClick) {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.9);
    bg.fillRoundedRect(-BL.BTN_W/2, -BL.BTN_H/2, BL.BTN_W, BL.BTN_H, 6);
    container.add(bg);

    const text = this.add.text(0, 0, label, TS.btn).setOrigin(0.5);
    container.add(text);

    // Hit area
    const hitZone = this.add.zone(0, 0, BL.BTN_W, BL.BTN_H).setOrigin(0.5);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', onClick);
    hitZone.on('pointerover', () => container.setScale(1.05));
    hitZone.on('pointerout', () => container.setScale(1));
    container.add(hitZone);

    container._bg = bg;
    container._text = text;
    container._zone = hitZone;
    container._color = color;
    return container;
  }

  _setFightEnabled(enabled) {
    if (!this._fightBtn) return;
    this._fightBtn.setAlpha(enabled ? 1 : 0.4);
    this._fightBtn._zone.input.enabled = enabled;
  }

  // ── Willpower Displays ─────────────────────────────────────
  _buildWillpowerDisplays() {
    this._pWP = this._buildWPStack('player', (this._PX||BL.PX), (this._WP_Y||BL.WP_Y));
    this._eWP = this._buildWPStack('enemy', (this._EX||BL.EX), (this._WP_Y||BL.WP_Y));
  }

  _buildWPStack(side, cx, cy) {
    const container = this.add.container(cx, cy);
    const teamKey = side === 'player' ? this._pt : this._et;
    const team = B[teamKey];
    const ghost = activeGhost(team);
    if (!ghost || !ghost.willpower) return container;

    // Stack visual: show up to 6 cards offset
    const maxShow = Math.min(ghost.willpower.length, 6);
    for (let i = 0; i < maxShow; i++) {
      const cardId = ghost.willpower[i];
      const wpCard = typeof wpCardById === 'function' ? wpCardById(cardId) : null;
      const isTop = (i === 0);

      const cw = 32, ch = 40;
      const ox = i * 3, oy = i * -3;

      const cardGfx = this.add.graphics();
      cardGfx.fillStyle(isTop ? 0x2a1828 : 0x1a1420, 0.9);
      cardGfx.fillRoundedRect(-cw/2 + ox, -ch/2 + oy, cw, ch, 4);
      cardGfx.lineStyle(1, isTop ? BC.GOLD_HEX : 0x333333, 0.8);
      cardGfx.strokeRoundedRect(-cw/2 + ox, -ch/2 + oy, cw, ch, 4);
      container.add(cardGfx);

      // Card icon
      const emoji = wpCard ? wpCard.emoji : '♥';
      const icon = this.add.text(ox, oy, emoji, TS.wpCard).setOrigin(0.5);
      if (!isTop) icon.setAlpha(0.4);
      container.add(icon);
    }

    // Count label
    const label = this.add.text(0, 30, `WP: ${ghost.willpower.length}`, TS.wpLabel).setOrigin(0.5);
    container.add(label);

    // Clickable top card for activation (player only)
    if (side === 'player' && ghost.willpower.length > 0) {
      const hitZone = this.add.zone(0, 0, 40, 48).setOrigin(0.5);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => this._activateWillpower());
      container.add(hitZone);
    }

    container._side = side;
    return container;
  }

  _activateWillpower() {
    if (this._rolling) return;
    if (typeof activateWillpower !== 'function') return;

    const card = activateWillpower(this._pt, this._pt, (msg) => this._addLog(msg, 'ability'));
    if (card) {
      this._showCallout(`${card.emoji} ${card.name}`, 'ability', card.desc, 1200);
      if (typeof GameAudio !== 'undefined') GameAudio.collect();
      this._rebuildWP();
      this.syncUI();
    }
  }

  _rebuildWP() {
    if (this._pWP) this._pWP.destroy();
    if (this._eWP) this._eWP.destroy();
    this._pWP = this._buildWPStack('player', (this._PX||BL.PX), (this._WP_Y||BL.WP_Y));
    this._eWP = this._buildWPStack('enemy', (this._EX||BL.EX), (this._WP_Y||BL.WP_Y));
  }

  // ── Resource Bar ───────────────────────────────────────────
  _buildResourceBar() {
    if (this._resContainer) this._resContainer.destroy();
    this._resContainer = this.add.container((this._CX||BL.CX), (this._RES_Y||BL.RES_Y));

    const team = B[this._pt];
    if (!team || !team.resources) return;

    const DISPLAY = typeof RESOURCE_DISPLAY !== 'undefined' ? RESOURCE_DISPLAY : {};
    const entries = Object.entries(DISPLAY).filter(([key]) => (team.resources[key] || 0) > 0);

    const tileW = 56, tileH = 44, gap = 6;
    const totalW = entries.length * (tileW + gap) - gap;
    const startX = -totalW / 2;

    entries.forEach(([key, cfg], i) => {
      const x = startX + i * (tileW + gap);
      const count = team.resources[key] || 0;

      const bg = this.add.graphics();
      bg.fillStyle(0x1c1626, 0.85);
      bg.fillRoundedRect(x, -tileH/2, tileW, tileH, 6);
      bg.lineStyle(1, 0xffffff, 0.06);
      bg.strokeRoundedRect(x, -tileH/2, tileW, tileH, 6);
      this._resContainer.add(bg);

      const icon = this.add.text(x + tileW/2, -8, cfg.emoji, TS.resIcon).setOrigin(0.5);
      this._resContainer.add(icon);

      const countText = this.add.text(x + tileW/2, 12, `${count}`, TS.res).setOrigin(0.5);
      this._resContainer.add(countText);
    });
  }

  // ── Battle Log ─────────────────────────────────────────────
  _buildBattleLog() {
    this._logContainer = this.add.container((this._LOG_X||BL.LOG_X), (this._LOG_Y||BL.LOG_Y));

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x140e1c, 0.9);
    bg.fillRoundedRect(-140, -50, 280, 100, 6);
    bg.lineStyle(1, BC.GOLD_HEX, 0.3);
    bg.strokeRoundedRect(-140, -50, 280, 100, 6);
    this._logContainer.add(bg);

    // Title
    const title = this.add.text(0, -40, 'BATTLE LOG', TS.logTitle).setOrigin(0.5);
    this._logContainer.add(title);

    // Text area (last 5 entries)
    this._logText = this.add.text(0, 8, '', { ...TS.log, lineSpacing: 4 }).setOrigin(0.5);
    this._logContainer.add(this._logText);
  }

  _addLog(text, type) {
    this._logEntries.push({ text, type });
    // Show last 5
    const recent = this._logEntries.slice(-5);
    const display = recent.map(e => e.text).join('\n');
    if (this._logText) this._logText.setText(display);
  }

  // ── Callout Banner ─────────────────────────────────────────
  _showCallout(text, type, subtitle, duration) {
    duration = duration || 2000;

    const callout = this.add.container((this._CX||BL.CX), (this._H||BL.H) / 2);
    callout.setDepth(1000);

    // Backdrop
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.6);
    backdrop.fillRect(-(this._W||BL.W)/2, -60, (this._W||BL.W), 120);
    callout.add(backdrop);

    // Gold border lines
    const lines = this.add.graphics();
    lines.fillStyle(BC.GOLD_HEX, 0.8);
    lines.fillRect(-200, -52, 400, 2);
    lines.fillRect(-200, 50, 400, 2);
    callout.add(lines);

    // Main text
    const style = { ...TS.callout };
    if (type === 'ko') style.color = '#ff3333';
    if (type === 'heal') style.color = '#4ade80';
    if (type === 'damage') style.color = '#e94560';
    const mainText = this.add.text(0, -10, text, style).setOrigin(0.5);
    callout.add(mainText);

    // Subtitle
    if (subtitle) {
      const sub = this.add.text(0, 30, subtitle, TS.callSub).setOrigin(0.5);
      sub.setAlpha(0);
      this.tweens.add({ targets: sub, alpha: 1, y: 25, duration: 300, delay: 200 });
      callout.add(sub);
    }

    // Drop-in animation
    callout.setScale(0.3);
    callout.setAlpha(0);
    this.tweens.add({
      targets: callout,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });

    // Exit after duration
    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: callout,
        alpha: 0, scaleY: 0.5,
        duration: 300,
        onComplete: () => callout.destroy()
      });
    });

    return callout;
  }

  // ── Floating damage text ───────────────────────────────────
  _showFloat(x, y, text, color) {
    const ft = this.add.text(x, y, text, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '28px',
      color: color || '#e94560', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(500);

    this.tweens.add({
      targets: ft,
      y: y - 50, alpha: 0, scaleX: 1.3, scaleY: 1.3,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => ft.destroy()
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  COMBAT ROUND (logic preserved from original)
  // ═══════════════════════════════════════════════════════════

  doRound() {
    if (!B || !this.pg || !this.eg) return;
    if (this.pg.hp <= 0 || this.eg.hp <= 0) return;
    if (this._rolling) return;
    this._rolling = true;
    this.roundNum++;
    this._setFightEnabled(false);
    if (typeof GameAudio !== 'undefined') GameAudio.dice();

    // Pre-roll abilities
    if (typeof triggerPreRoll === 'function') {
      triggerPreRoll(this._pt, (msg) => this._addLog(msg, 'ability'));
      triggerPreRoll(this._et, (msg) => this._addLog(msg, 'ability'));
      this.pg = activeGhost(B[this._pt]);
      this.eg = activeGhost(B[this._et]);
      this.syncUI();
    }

    // Pre-roll KO check
    if (this.pg.hp <= 0 || this.pg.ko) { this._rolling = false; this.time.delayedCall(600, () => this.checkKOSwap()); return; }
    if (this.eg.hp <= 0 || this.eg.ko) { this._rolling = false; this.time.delayedCall(600, () => this.handleEnemyKO()); return; }

    // Dice count
    const pDiceCount = typeof calculateDiceCount === 'function' ? calculateDiceCount(this._pt) : 3;
    const eDiceCount = typeof calculateDiceCount === 'function' ? calculateDiceCount(this._et) : 3;

    // Roll
    const pDice = weightedRoll(B[this._pt], pDiceCount);
    const eDice = weightedRoll(B[this._et], eDiceCount);

    // Moonstone / Lucky Stone
    if (B._moonstoneReady && B._moonstoneReady[this._pt]) {
      if (typeof smartMoonstoneChange === 'function') smartMoonstoneChange(pDice);
    }
    if (B._luckyStoneReady && B._luckyStoneReady[this._pt]) {
      if (typeof smartLuckyStone === 'function') smartLuckyStone(pDice);
    }

    if (!B.lastRollDiceCount) B.lastRollDiceCount = {};
    B.lastRollDiceCount[this._pt] = pDiceCount;
    B.lastRollDiceCount[this._et] = eDiceCount;

    // Tumble animation then resolve
    this._tumbleDice(pDice, eDice, () => {
      this._showDice('player', pDice, false);
      this._showDice('enemy', eDice, false);
      this.time.delayedCall(200, () => this.resolveDice(pDice, eDice));
    });
  }

  // ── RESOLVE DICE ───────────────────────────────────────────
  resolveDice(pDice, eDice) {
    const pRes = classify(pDice);
    const eRes = classify(eDice);

    const pF = activeGhost(B[this._pt]);
    const eF = activeGhost(B[this._et]);
    const hectorActive = (pF && pF.id === 96 && !pF.ko) || (eF && eF.id === 96 && !eF.ko);
    const rawWinner = compareRolls(pRes, eRes, pDice, eDice, hectorActive);

    // Normalize: battle.js returns 'a'/'b'/'tie', dice-engine returns 'red'/'blue'/null
    let winner = rawWinner;
    if (rawWinner === 'a') winner = 'red';
    else if (rawWinner === 'b') winner = 'blue';
    else if (rawWinner === 'tie') winner = null;

    const pWin = winner === 'red' || winner === this._pt;
    const eWin = winner === 'blue' || winner === this._et;

    // Roll announcements
    if (typeof RollAnnouncer !== 'undefined') {
      const pAnn = RollAnnouncer.announce(pRes, pWin, 'red');
      const eAnn = RollAnnouncer.announce(eRes, eWin, 'blue');

      this._showDice('player', pDice, pWin);
      this._showDice('enemy', eDice, eWin);
      // Dim the loser's dice
      if (typeof Dice3D !== 'undefined') {
        if (pWin) Dice3D.highlightLose('blue');
        else if (eWin) Dice3D.highlightLose('red');
      }
      this._showRollResult('player', RollAnnouncer.formatResult(pRes), pWin);
      this._showRollResult('enemy', RollAnnouncer.formatResult(eRes), eWin);

      if (pAnn.shake && pWin) this.cameras.main.shake(pAnn.shake.duration, pAnn.shake.intensity);
      if (eAnn.shake && eWin) this.cameras.main.shake(eAnn.shake.duration, eAnn.shake.intensity);
    }

    const logText = `R${this.roundNum}: ${describeRoll(pRes)} vs ${describeRoll(eRes)}`;

    if (pWin) {
      const dmg = typeof calculateDamage === 'function' ? calculateDamage(this._pt, pRes, pDice) : pRes.damage;
      const dodged = typeof checkSylviaDodge === 'function' && checkSylviaDodge(this._et);

      if (dodged) {
        this._addLog(logText + ' — DODGED!', 'dodge');
        this._showFloat((this._EX||BL.EX), (this._FIGHT_Y||BL.FIGHT_Y) - 50, 'DODGE!', '#44ddff');
      } else {
        const reduction = typeof calculateDamageReduction === 'function' ? calculateDamageReduction(this._et, pRes) : 0;
        const finalDmg = Math.max(1, dmg - reduction);

        wpDamage(this.eg, finalDmg);
        if (this.eg.ko) this.eg.killedBy = this.pg.id;

        this._addLog(`${logText} — ${finalDmg} dmg to ${this.eg.name}!`, 'damage');
        if (typeof GameAudio !== 'undefined') GameAudio.hit();

        // Damage float + camera shake for big hits
        this._showFloat((this._EX||BL.EX), (this._FIGHT_Y||BL.FIGHT_Y) - 60, `-${finalDmg}`, finalDmg >= 4 ? '#ff3333' : '#e94560');
        if (finalDmg >= 4) this.cameras.main.shake(200, 0.01);

        if (finalDmg >= 4) {
          this._showCallout(`-${finalDmg} DAMAGE`, finalDmg >= 6 ? 'damage' : 'damage', '', 1000);
        }

        this.reportRaidDamage(finalDmg, pDice);
        if (typeof triggerWinPath === 'function') triggerWinPath(this._pt, pRes);
      }
    } else if (eWin) {
      const dmg = typeof calculateDamage === 'function' ? calculateDamage(this._et, eRes, eDice) : eRes.damage;
      const pDodged = typeof checkSylviaDodge === 'function' && checkSylviaDodge(this._pt);

      if (pDodged) {
        this._addLog(logText + ' — DODGED!', 'dodge');
        this._showFloat((this._PX||BL.PX), (this._FIGHT_Y||BL.FIGHT_Y) - 50, 'DODGE!', '#44ddff');
      } else {
        const reduction = typeof calculateDamageReduction === 'function' ? calculateDamageReduction(this._pt, eRes) : 0;
        const finalDmg = Math.max(1, dmg - reduction);

        wpDamage(this.pg, finalDmg);
        this._addLog(`${logText} — ${finalDmg} dmg to ${this.pg.name}!`, 'damage');
        if (typeof GameAudio !== 'undefined') GameAudio.hurt();
        this._showFloat((this._PX||BL.PX), (this._FIGHT_Y||BL.FIGHT_Y) - 60, `-${finalDmg}`, '#e94560');
        if (finalDmg >= 4) this.cameras.main.shake(150, 0.008);
      }

      if (typeof triggerWinPath === 'function') triggerWinPath(this._et, eRes);
      if (typeof triggerOnLoss === 'function') triggerOnLoss(this._pt);
    } else {
      this._addLog(logText + ' — Tie!', 'system');
    }

    // Sync UI
    this.syncUI();

    // Reset round
    if (typeof resetRoundFlags === 'function') resetRoundFlags();
    this._rolling = false;
    this._setFightEnabled(true);

    // Refresh active refs
    this.pg = activeGhost(B[this._pt]);
    this.eg = activeGhost(B[this._et]);

    // KO check
    if (this.eg && (this.eg.hp <= 0 || this.eg.ko)) {
      this._setFightEnabled(false);
      this.time.delayedCall(600, () => this.handleEnemyKO());
    } else if (this.pg && (this.pg.hp <= 0 || this.pg.ko)) {
      this._setFightEnabled(false);
      this.time.delayedCall(600, () => this.checkKOSwap());
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  SYNC UI STATE
  // ═══════════════════════════════════════════════════════════

  syncUI() {
    this.pg = activeGhost(B[this._pt]);
    this.eg = activeGhost(B[this._et]);
    this._updateFighterCard(this._pCard, this.pg);
    this._updateFighterCard(this._eCard, this.eg);
    this._rebuildSideline('player');
    this._rebuildSideline('enemy');
    this._rebuildWP();
    this._buildResourceBar();
  }

  // ═══════════════════════════════════════════════════════════
  //  KO HANDLING
  // ═══════════════════════════════════════════════════════════

  handleEnemyKO() {
    this.eg.ko = true;
    this._showCallout('KO!', 'ko', `${this.eg.name} has fallen!`, 1500);
    this._addLog(`${this.eg.name} has fallen!`, 'ko');
    if (typeof GameAudio !== 'undefined') GameAudio.hit();

    const eTeam = B[this._et];
    const eLiving = eTeam.ghosts.filter((g, i) => i !== eTeam.activeIdx && !g.ko && g.hp > 0);
    if (eLiving.length > 0) {
      const nextIdx = typeof smartPickSwap === 'function'
        ? smartPickSwap(this._et) : eTeam.ghosts.indexOf(eLiving[0]);
      if (nextIdx >= 0) {
        this.time.delayedCall(1600, () => {
          if (typeof performKOSwap === 'function') {
            performKOSwap(this._et, nextIdx, (msg) => this._addLog(msg, 'system'));
          } else {
            eTeam.activeIdx = nextIdx;
          }
          this.eg = activeGhost(eTeam);
          if (typeof triggerEntry === 'function') triggerEntry(eTeam, this._et);

          // Rebuild enemy card with new active ghost
          if (this._eCard) this._eCard.destroy();
          this._eCard = this._buildFighterCard(this.eg, 'enemy', (this._EX||BL.EX), (this._FIGHT_Y||BL.FIGHT_Y));
          this.syncUI();
          this._setFightEnabled(true);
        });
      }
    } else {
      this.time.delayedCall(1600, () => this._exit(true));
    }
  }

  checkKOSwap() {
    this.pg.ko = true;
    this.pg.hp = 0;
    this._showCallout('KO!', 'ko', `${this.pg.name} has fallen!`, 1500);
    this._addLog(`${this.pg.name} has fallen!`, 'ko');

    const pTeam = B[this._pt];
    const living = [];
    pTeam.ghosts.forEach((g, i) => {
      if (!g.ko && g.hp > 0 && i !== pTeam.activeIdx) living.push({ ghost: g, idx: i });
    });
    if (living.length === 0) {
      this.time.delayedCall(1600, () => this._exit(false));
      return;
    }
    this.time.delayedCall(1600, () => this._showKOPicker(living));
  }

  // ── KO Swap Picker (Phaser-native modal) ───────────────────
  _showKOPicker(living) {
    const overlay = this.add.container((this._CX||BL.CX), (this._H||BL.H) / 2).setDepth(2000);

    // Darken backdrop
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.82);
    backdrop.fillRect(-(this._W||BL.W)/2, -(this._H||BL.H)/2, (this._W||BL.W), (this._H||BL.H));
    overlay.add(backdrop);

    // Title
    const title = this.add.text(0, -180, 'YOUR SPIRITKIN HAS FALLEN', {
      fontFamily: 'Courier New, monospace', fontSize: '14px',
      color: '#ff5544', letterSpacing: 2
    }).setOrigin(0.5);
    overlay.add(title);

    const sub = this.add.text(0, -155, 'Choose a replacement', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#bbb'
    }).setOrigin(0.5);
    overlay.add(sub);

    // Cards
    const cardW = 160, cardH = 200, gap = 20;
    const totalW = living.length * (cardW + gap) - gap;
    const startX = -totalW / 2 + cardW / 2;

    living.forEach((entry, i) => {
      const g = entry.ghost;
      const cx = startX + i * (cardW + gap);
      const card = this.add.container(cx, 30);

      // Card bg
      const rarHex = _rarityHex(g.rarity);
      const cbg = this.add.graphics();
      cbg.fillStyle(0x1a1a2e, 1);
      cbg.fillRoundedRect(-cardW/2, -cardH/2, cardW, cardH, 8);
      cbg.lineStyle(2, rarHex, 0.8);
      cbg.strokeRoundedRect(-cardW/2, -cardH/2, cardW, cardH, 8);
      card.add(cbg);

      // Rarity bar
      const rBar = this.add.graphics();
      rBar.fillStyle(rarHex, 1);
      rBar.fillRect(-cardW/2 + 2, -cardH/2 + 2, cardW - 4, 3);
      card.add(rBar);

      // Art
      const artKey = 'ghost_' + g.id;
      if (this.textures.exists(artKey)) {
        const art = this.add.image(0, -30, artKey);
        art.setDisplaySize(cardW - 20, 100);
        card.add(art);
      }

      // Name
      card.add(this.add.text(0, 38, g.name, { fontFamily: 'Courier New, monospace', fontSize: '11px', color: '#fff' }).setOrigin(0.5));

      // HP bar
      const hpPct = g.maxHp > 0 ? g.hp / g.maxHp : 0;
      const hpBarW = cardW - 30;
      const hpBg = this.add.graphics();
      hpBg.fillStyle(0x1a1a1a, 1);
      hpBg.fillRoundedRect(-hpBarW/2, 55, hpBarW, 8, 3);
      card.add(hpBg);
      const hpFill = this.add.graphics();
      hpFill.fillStyle(_hpHex(g.hp, g.maxHp), 1);
      hpFill.fillRoundedRect(-hpBarW/2, 55, hpBarW * hpPct, 8, 3);
      card.add(hpFill);

      // HP text
      card.add(this.add.text(0, 72, `WP ${g.hp} / ${g.maxHp}`, { fontFamily: 'Georgia, serif', fontSize: '11px', color: '#aaa' }).setOrigin(0.5));

      // Ability
      if (g.ability) {
        card.add(this.add.text(0, 88, g.ability, { fontFamily: 'Georgia, serif', fontSize: '10px', color: BC.GOLD }).setOrigin(0.5));
      }

      // Interactive
      const hitZone = this.add.zone(0, 0, cardW, cardH).setOrigin(0.5);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerover', () => {
        card.setScale(1.05);
        cbg.clear();
        cbg.fillStyle(0x1a1a2e, 1);
        cbg.fillRoundedRect(-cardW/2, -cardH/2, cardW, cardH, 8);
        cbg.lineStyle(3, BC.GOLD_HEX, 1);
        cbg.strokeRoundedRect(-cardW/2, -cardH/2, cardW, cardH, 8);
      });
      hitZone.on('pointerout', () => {
        card.setScale(1);
        cbg.clear();
        cbg.fillStyle(0x1a1a2e, 1);
        cbg.fillRoundedRect(-cardW/2, -cardH/2, cardW, cardH, 8);
        cbg.lineStyle(2, rarHex, 0.8);
        cbg.strokeRoundedRect(-cardW/2, -cardH/2, cardW, cardH, 8);
      });
      hitZone.on('pointerdown', () => {
        // Pulse then close
        this.tweens.add({
          targets: card, scaleX: 1.1, scaleY: 1.1,
          duration: 150, yoyo: true,
          onComplete: () => {
            overlay.destroy();
            this._doKOSwap(entry);
          }
        });
      });
      card.add(hitZone);

      // Slide-in animation
      card.setAlpha(0);
      card.y += 30;
      this.tweens.add({
        targets: card, alpha: 1, y: 30 - 30,
        duration: 300, delay: i * 80, ease: 'Cubic.easeOut'
      });

      overlay.add(card);
    });

    this._koOverlay = overlay;
  }

  _doKOSwap(entry) {
    if (typeof performKOSwap === 'function') {
      performKOSwap(this._pt, entry.idx, (msg) => this._addLog(msg, 'system'));
    } else {
      B[this._pt].activeIdx = entry.idx;
    }
    this.pg = activeGhost(B[this._pt]);
    if (typeof triggerEntry === 'function') triggerEntry(B[this._pt], this._pt);

    // Rebuild player card
    if (this._pCard) this._pCard.destroy();
    this._pCard = this._buildFighterCard(this.pg, 'player', (this._PX||BL.PX), (this._FIGHT_Y||BL.FIGHT_Y));
    this.syncUI();
    this._rolling = false;
    this._setFightEnabled(true);
  }

  // ═══════════════════════════════════════════════════════════
  //  END BATTLE
  // ═══════════════════════════════════════════════════════════

  _exit(won) {
    // Clean up 3D dice overlay
    if (typeof Dice3D !== 'undefined') Dice3D.destroy();
    // Restore world HUD
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = '';

    let leveledUp = false, xpGain = 0, coinChange = 0;

    // Persist healing seeds
    const pTeam = B ? B[this._pt] : null;
    if (pTeam && pTeam.resources) {
      G.healingSeeds = pTeam.resources.healingSeed ?? G.healingSeeds;
    }

    if (won) {
      if (!G.rep) G.rep = { battlesWon: 0, craftsCompleted: 0, itemsSold: 0, essencesCollected: 0, raresFound: 0 };
      G.rep.battlesWon++;
      coinChange = 1 + Math.floor(Math.random() * 3);
      G.coins += coinChange;
      const rarityXP = { common: 1, uncommon: 2, rare: 3, 'ghost-rare': 4, legendary: 5 };
      xpGain = rarityXP[this.eg?.rarity] || 1;
      if (this.battleData.blackRider) xpGain += 5;
      if (this.battleData.worldBoss) { xpGain += 10; coinChange += 100; }
      G.xp += xpGain;
      const xpNeeded = G.level * 3;
      if (G.xp >= xpNeeded) {
        G.level++; G.xp -= xpNeeded; leveledUp = true;
        for (const ghost of G.team) { ghost.hp = ghost.maxHp; ghost.ko = false; }
      }
      if (typeof checkAndNotifyTitles === 'function') checkAndNotifyTitles();
      if (typeof addProfessionXP === 'function') addProfessionXP('combat', 10);
      if (B?.isHostileNPC && typeof markHostileNPCDefeated === 'function') markHostileNPCDefeated(B.isHostileNPC);
      if (this.battleData.worldBoss) G.worldBossesDefeated = (G.worldBossesDefeated || 0) + 1;
    } else {
      const penalty = Math.min(G.coins, 2 + Math.floor(Math.random() * 3));
      if (penalty > 0) { G.coins -= penalty; coinChange = -penalty; }
    }

    // Sync HP back
    if (pTeam) {
      pTeam.ghosts.forEach((ghost, i) => {
        if (G.team[i]) { G.team[i].hp = ghost.hp; G.team[i].ko = ghost.ko; }
      });
    }

    G.inBattle = false;
    B = null;
    if (G.activeBuffs) {
      G.activeBuffs.forEach(b => { if (b.fights > 0) b.fights--; });
      G.activeBuffs = G.activeBuffs.filter(b => b.fights > 0);
    }
    saveGame();

    // Victory/Defeat callout then return to world
    const text = won ? 'VICTORY!' : 'DEFEAT';
    const type = won ? 'ability' : 'ko';
    let subtitle = '';
    if (won) {
      subtitle = `+${xpGain} XP  +${coinChange} Gold`;
      if (leveledUp) subtitle += `  LEVEL ${G.level}!`;
    } else if (coinChange < 0) {
      subtitle = `${coinChange} Gold`;
    }

    this._showCallout(text, type, subtitle, 2500);

    this.time.delayedCall(2800, () => {
      if (typeof GameAudio !== 'undefined') { won ? GameAudio.victory() : GameAudio.defeat(); }
      this.cameras.main.fadeOut(300, 0, 0, 0, (cam, progress) => {
        if (progress >= 1) {
          this.scene.stop();
          this.scene.resume('WorldScene');
          const ws = this.scene.get('WorldScene');
          if (ws && ws.cameras) ws.cameras.main.fadeIn(300);
        }
      });
    });
  }

  // ── Raid damage reporting ──────────────────────────────────
  reportRaidDamage(dmg, dice) {
    if (!this._raidId || typeof RaidManager === 'undefined') return;
    RaidManager.reportDamage(this._raidId, dmg, dice);
  }

  // ── Legacy stubs (in case anything external calls these) ───
  endBattle(won) { this._exit(won); }
  updateHP() { this.syncUI(); }
  refreshWillpowerStacks() { this._rebuildWP(); }
  renderSideline() { this.syncUI(); }
  buildResourceBar() { this._buildResourceBar(); }
  rebuildResourceBar() { this._buildResourceBar(); }
  showFloatingText(x, y, t, c) { this._showFloat(x, y, t, c); }
  flashScreen() { this.cameras.main.flash(200); }
  buildRaidPartyStrip() {}
  showRaidFeedEntry() {}
  renderWillpowerStack() { this._rebuildWP(); }
}
