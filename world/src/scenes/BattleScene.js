// ═══════════════════════════════════════════════════════════════
// BATTLE SCENE — Testroom-quality layout (v88)
// Phaser-native + 3D dice DOM overlay.
// Matches the testroom visual: large active cards, sideline stacks,
// team-colored roll buttons, willpower+resource bar, narrative status.
// ═══════════════════════════════════════════════════════════════

// ── Colors ────────────────────────────────────────────────────
const BC = {
  BG: 0x0e1528,
  RED: 0xe94560, BLUE: 0x4cc9f0,
  RED_S: '#e94560', BLUE_S: '#4cc9f0',
  GOLD: '#d4a040', GOLD_H: 0xd4a040,
  TEXT: '#f0e8d4', DIM: '#6a6a80', DARK: '#1a1a2e',
  HP_G: '#27ae60', HP_Y: '#f1c40f', HP_R: '#e74c3c',
  SURFACE: 0x161c2e, CARD_BG: 0x1a2036,
  RARITY: { common: 0x8b95a5, uncommon: 0x2ecc71, rare: 0x3498db, 'ghost-rare': 0x9b59b6, legendary: 0xf39c12 },
  RARITY_S: { common: '#8b95a5', uncommon: '#2ecc71', rare: '#3498db', 'ghost-rare': '#9b59b6', legendary: '#f39c12' },
};

function _artUrl(ghost) {
  let url = ghost.art || '';
  if (!url) { const s = (ghost.name||'unknown').toLowerCase().replace(/\s+/g,'_'); url = `../testroom/art/originals/${s}.png`; }
  if (url.startsWith('../testroom/')) url = 'https://drbango.com/testroom/' + url.slice('../testroom/'.length);
  return url;
}
function _hpCol(hp,mx) { const p=hp/mx; return p>0.5?BC.HP_G:p>0.25?BC.HP_Y:BC.HP_R; }
function _hpHex(hp,mx) { const p=hp/mx; return p>0.5?0x27ae60:p>0.25?0xf1c40f:0xe74c3c; }
function _rarH(r) { return BC.RARITY[(r||'common').toLowerCase()]||BC.RARITY.common; }
function _rarS(r) { return BC.RARITY_S[(r||'common').toLowerCase()]||BC.RARITY_S.common; }

// ═══════════════════════════════════════════════════════════════
class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }
  init(data) { this.battleData = data || {}; }

  create() {
    if (!B) { this._exit(false); return; }
    if (typeof applyBuffsToBattle === 'function') applyBuffsToBattle();
    if (typeof applyFortuneToBattle === 'function') applyFortuneToBattle();

    this._pt = 'red'; this._et = 'blue';
    const pT = B[this._pt], eT = B[this._et];
    if (!pT || !eT) { this._exit(false); return; }

    // Hide world HUD
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = 'none';

    // Enrich ghosts
    const enrich = g => { if (typeof ALL_CARDS!=='undefined') { const c=ALL_CARDS.find(x=>x.id===g.id); if(c){if(!g.art)g.art=c.art;if(!g.abilityDesc&&c.desc)g.abilityDesc=c.desc;if(!g.ability&&c.ability)g.ability=c.ability;if(!g.rarity&&c.rarity)g.rarity=c.rarity;}} return g; };
    pT.ghosts.forEach(enrich); eT.ghosts.forEach(enrich);

    this.pg = activeGhost(pT); this.eg = activeGhost(eT);
    if (!this.pg || !this.eg) { this._exit(false); return; }

    B.battleStarted = true; this.roundNum = 0; this._rolling = false;
    this._raidId = this.battleData.raidId || null;
    this._logEntries = [];

    this._loadArt(() => this._buildStage());
  }

  _loadArt(cb) {
    const all = [...B[this._pt].ghosts, ...B[this._et].ghosts];
    let n = 0;
    all.forEach(g => { const k='ghost_'+g.id; if(!this.textures.exists(k)){const u=_artUrl(g);if(u){this.load.image(k,u);n++;}} });
    if (n > 0) { this.load.on('loaderror',()=>{}); this.load.once('complete',cb); this.load.start(); }
    else cb();
  }

  // ═══════════════════════════════════════════════════════════
  //  BUILD THE STAGE — Testroom layout
  // ═══════════════════════════════════════════════════════════
  _buildStage() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    this._W = W; this._H = H;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(BC.BG, 1);
    bg.fillRect(0, 0, W, H);
    // Subtle radial glow behind each fighter
    const glow = this.add.graphics();
    glow.fillStyle(BC.RED, 0.06);
    glow.fillCircle(W * 0.30, H * 0.40, 200);
    glow.fillStyle(BC.BLUE, 0.06);
    glow.fillCircle(W * 0.70, H * 0.40, 200);

    // ── Active fighters (large cards) ──
    this._pActive = this._buildActiveCard(this.pg, 'red', W * 0.28, H * 0.38);
    this._eActive = this._buildActiveCard(this.eg, 'blue', W * 0.70, H * 0.38);

    // ── Sideline stacks ──
    this._pSideline = this._buildSidelineStack('red', W * 0.07, H * 0.15);
    this._eSideline = this._buildSidelineStack('blue', W * 0.93, H * 0.15);

    // ── Dice area (3D DOM overlay) ──
    if (typeof Dice3D !== 'undefined') Dice3D.init();

    // ── Willpower + Resources ──
    this._pWPArea = this._buildWPArea('red', W * 0.18, H * 0.82);
    this._eWPArea = this._buildWPArea('blue', W * 0.82, H * 0.82);

    // ── Roll buttons ──
    this._redBtn = this._buildRollBtn(W * 0.15, H * 0.93, 'RED ROLL', BC.RED, () => this.doRound());
    this._blueBtn = this._buildRollBtn(W * 0.85, H * 0.93, 'BLUE ROLL', BC.BLUE, null); // enemy auto-rolls

    // ── Status bar (narrative text at bottom center) ──
    this._statusBar = this.add.text(W * 0.5, H * 0.97, '', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: BC.GOLD,
      align: 'center', backgroundColor: '#0e152888', padding: { x: 12, y: 4 },
    }).setOrigin(0.5).setDepth(100);

    // ── Close button (top right) ──
    const closeBtn = this.add.text(W - 20, 10, '✕', {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#666',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(100);
    closeBtn.on('pointerdown', () => this._exit(false));

    // Fire entry effects
    if (typeof triggerEntry === 'function') {
      const pC = triggerEntry(B[this._pt], this._pt);
      const eC = triggerEntry(B[this._et], this._et);
      [...(pC||[]),...(eC||[])].forEach(c => { if(c&&c.desc) this._addLog(c.desc,'ability'); });
    }

    const header = this.battleData.trainerName ? `${this.battleData.trainerName} challenges you!` : `Wild ${this.eg.name} appears!`;
    this._setStatus(header);

    this.cameras.main.fadeIn(300, 14, 21, 40);
  }

  // ── ACTIVE FIGHTER CARD (large) ─────────────────────────
  _buildActiveCard(ghost, team, cx, cy) {
    const c = this.add.container(cx, cy);
    const isRed = team === 'red';
    const tCol = isRed ? BC.RED : BC.BLUE;
    const tStr = isRed ? BC.RED_S : BC.BLUE_S;

    // Card dimensions (responsive)
    const cw = Math.min(this._W * 0.22, 280);
    const ch = cw * 1.35;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(BC.CARD_BG, 0.95);
    bg.fillRoundedRect(-cw/2, -ch/2, cw, ch, 10);
    bg.lineStyle(2, tCol, 0.9);
    bg.strokeRoundedRect(-cw/2, -ch/2, cw, ch, 10);
    c.add(bg);

    // Name at top
    c.add(this.add.text(0, -ch/2 + 16, ghost.name, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '17px', color: BC.TEXT, fontStyle: 'bold',
    }).setOrigin(0.5));

    // Art (fills most of the card)
    const artH = ch * 0.55;
    const artY = -ch/2 + 38 + artH/2;
    const artKey = 'ghost_' + ghost.id;
    if (this.textures.exists(artKey)) {
      const art = this.add.image(0, artY, artKey);
      art.setDisplaySize(cw - 16, artH);
      c.add(art);
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(_rarH(ghost.rarity), 0.15);
      ph.fillRect(-(cw-16)/2, artY - artH/2, cw-16, artH);
      c.add(ph);
      c.add(this.add.text(0, artY, ghost.name.substring(0,8).toUpperCase(), {
        fontFamily: 'Cinzel, serif', fontSize: '22px', color: _rarS(ghost.rarity),
      }).setOrigin(0.5));
    }

    // Ability badge
    const badgeY = artY + artH/2 + 18;
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(tCol, 0.9);
    badgeBg.fillRoundedRect(-50, badgeY - 10, 100, 20, 4);
    c.add(badgeBg);
    c.add(this.add.text(0, badgeY, (ghost.ability || '').toUpperCase(), {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '10px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Ability description
    c.add(this.add.text(0, badgeY + 22, ghost.abilityDesc || '', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#aab0c0',
      align: 'center', wordWrap: { width: cw - 24 }, lineSpacing: 2,
    }).setOrigin(0.5, 0));

    // HP bar at bottom
    const hpY = ch/2 - 20;
    const hpW = cw - 30;
    const hpBg = this.add.graphics();
    hpBg.fillStyle(0x0a0a14, 1);
    hpBg.fillRoundedRect(-hpW/2, hpY - 4, hpW, 8, 3);
    c.add(hpBg);
    const pct = Math.max(0, ghost.hp / (ghost.maxHp || 1));
    const hpFill = this.add.graphics();
    hpFill.fillStyle(_hpHex(ghost.hp, ghost.maxHp), 1);
    hpFill.fillRoundedRect(-hpW/2, hpY - 4, hpW * pct, 8, 3);
    c.add(hpFill);

    // HP badge (bottom right of card)
    c.add(this.add.text(cw/2 - 8, hpY - 14, `♥${ghost.hp}`, {
      fontFamily: 'Courier New, monospace', fontSize: '11px', color: _hpCol(ghost.hp, ghost.maxHp),
      backgroundColor: '#0a0a14cc', padding: { x: 3, y: 1 },
    }).setOrigin(1, 0.5));

    c._refs = { hpFill, hpW, hpY, ghost };
    return c;
  }

  _updateActiveCard(c, ghost) {
    if (!c || !c._refs) return;
    const r = c._refs;
    const pct = Math.max(0, ghost.hp / (ghost.maxHp || 1));
    r.hpFill.clear();
    r.hpFill.fillStyle(_hpHex(ghost.hp, ghost.maxHp), 1);
    r.hpFill.fillRoundedRect(-r.hpW/2, r.hpY - 4, r.hpW * pct, 8, 3);
  }

  // ── SIDELINE STACK (vertical, 2 cards) ──────────────────
  _buildSidelineStack(team, cx, topY) {
    const tKey = team === 'red' ? this._pt : this._et;
    const t = B[tKey];
    const c = this.add.container(cx, topY);
    const bench = t.ghosts.filter((_, i) => i !== t.activeIdx);
    const cw = Math.min(this._W * 0.12, 150);
    const ch = cw * 1.55;
    const gap = 12;

    bench.forEach((g, i) => {
      const y = i * (ch + gap);
      const card = this._buildSidelineCard(g, team, 0, y, cw, ch);
      c.add(card);
    });
    c._team = team;
    return c;
  }

  _buildSidelineCard(ghost, team, x, y, cw, ch) {
    const c = this.add.container(x, y);
    const tCol = team === 'red' ? BC.RED : BC.BLUE;
    const isKO = ghost.ko || ghost.hp <= 0;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(BC.CARD_BG, isKO ? 0.4 : 0.85);
    bg.fillRoundedRect(-cw/2, 0, cw, ch, 6);
    bg.lineStyle(1, isKO ? 0x333344 : tCol, 0.5);
    bg.strokeRoundedRect(-cw/2, 0, cw, ch, 6);
    c.add(bg);

    // Art
    const artH = ch * 0.45;
    const artKey = 'ghost_' + ghost.id;
    if (this.textures.exists(artKey)) {
      const art = this.add.image(0, artH/2 + 4, artKey);
      art.setDisplaySize(cw - 8, artH);
      if (isKO) art.setTint(0x333344);
      c.add(art);
    }

    // Name
    c.add(this.add.text(0, artH + 10, ghost.name, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '10px', color: isKO ? '#555' : BC.TEXT,
    }).setOrigin(0.5));

    // Ability badge
    const abilY = artH + 24;
    const abBg = this.add.graphics();
    abBg.fillStyle(tCol, isKO ? 0.3 : 0.7);
    abBg.fillRoundedRect(-cw/2 + 6, abilY - 6, cw - 12, 14, 3);
    c.add(abBg);
    c.add(this.add.text(0, abilY + 1, (ghost.ability || '').toUpperCase(), {
      fontFamily: 'Cinzel, serif', fontSize: '8px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Ability desc
    c.add(this.add.text(0, abilY + 16, ghost.abilityDesc || '', {
      fontFamily: 'Georgia, serif', fontSize: '8px', color: '#7a7a90',
      wordWrap: { width: cw - 14 }, align: 'center', lineSpacing: 1,
    }).setOrigin(0.5, 0));

    // HP badge (bottom right)
    const hpStr = isKO ? 'KO' : `♥${ghost.hp}`;
    c.add(this.add.text(cw/2 - 6, ch - 8, hpStr, {
      fontFamily: 'Courier New, monospace', fontSize: '10px',
      color: isKO ? BC.HP_R : _hpCol(ghost.hp, ghost.maxHp),
      backgroundColor: '#0a0a14cc', padding: { x: 3, y: 1 },
    }).setOrigin(1, 1));

    if (isKO) c.setAlpha(0.5);
    return c;
  }

  _rebuildSideline(team) {
    const old = team === 'red' ? this._pSideline : this._eSideline;
    if (old) old.destroy();
    const cx = team === 'red' ? this._W * 0.07 : this._W * 0.93;
    const s = this._buildSidelineStack(team, cx, this._H * 0.15);
    if (team === 'red') this._pSideline = s; else this._eSideline = s;
  }

  // ── WILLPOWER + RESOURCES AREA ──────────────────────────
  _buildWPArea(team, cx, cy) {
    const c = this.add.container(cx, cy);
    const tKey = team === 'red' ? this._pt : this._et;
    const t = B[tKey];
    const ghost = activeGhost(t);
    if (!ghost) return c;

    // Willpower card icon
    const topCard = ghost.willpower && ghost.willpower.length > 0 ? (typeof wpCardById === 'function' ? wpCardById(ghost.willpower[0]) : null) : null;
    const wpIcon = this.add.graphics();
    wpIcon.fillStyle(0x1a2040, 0.9);
    wpIcon.fillRoundedRect(-22, -28, 44, 56, 6);
    wpIcon.lineStyle(1, BC.GOLD_H, 0.6);
    wpIcon.strokeRoundedRect(-22, -28, 44, 56, 6);
    c.add(wpIcon);
    c.add(this.add.text(0, -4, topCard ? topCard.emoji : '♥', {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5));
    if (topCard) {
      c.add(this.add.text(0, 18, topCard.name.toUpperCase(), {
        fontFamily: 'Courier New, monospace', fontSize: '6px', color: BC.GOLD,
      }).setOrigin(0.5));
    }

    // WP count
    c.add(this.add.text(40, -8, `${ghost.willpower ? ghost.willpower.length : ghost.hp}`, {
      fontFamily: 'Cinzel, serif', fontSize: '20px', color: BC.TEXT, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(this.add.text(40, 8, 'WILLPOWER', {
      fontFamily: 'Courier New, monospace', fontSize: '8px', color: BC.DIM,
    }).setOrigin(0, 0.5));
    c.add(this.add.text(40, 20, `cards: ${t.wpDeck ? t.wpDeck.length : 0} · discard: ${t.wpDiscard ? t.wpDiscard.length : 0}`, {
      fontFamily: 'Courier New, monospace', fontSize: '7px', color: '#4a4a60',
    }).setOrigin(0, 0.5));

    // Resources below
    const res = t.resources || {};
    const RDISPLAY = typeof RESOURCE_DISPLAY !== 'undefined' ? RESOURCE_DISPLAY : {};
    let rx = -20;
    Object.entries(RDISPLAY).forEach(([key, cfg]) => {
      const count = res[key] || 0;
      if (count <= 0) return;
      c.add(this.add.text(rx, 38, `${cfg.emoji}${count}`, {
        fontFamily: 'sans-serif', fontSize: '13px', color: cfg.color || BC.TEXT,
        backgroundColor: '#0a0a14aa', padding: { x: 3, y: 1 },
      }).setOrigin(0, 0.5));
      rx += 40;
    });

    // Click to activate willpower (player only)
    if (team === 'red') {
      wpIcon.setInteractive(new Phaser.Geom.Rectangle(-22, -28, 44, 56), Phaser.Geom.Rectangle.Contains);
      wpIcon.on('pointerdown', () => this._activateWillpower());
    }

    return c;
  }

  _rebuildWP() {
    if (this._pWPArea) this._pWPArea.destroy();
    if (this._eWPArea) this._eWPArea.destroy();
    this._pWPArea = this._buildWPArea('red', this._W * 0.18, this._H * 0.82);
    this._eWPArea = this._buildWPArea('blue', this._W * 0.82, this._H * 0.82);
  }

  _activateWillpower() {
    if (this._rolling) return;
    if (typeof activateWillpower !== 'function') return;
    const card = activateWillpower(this._pt, this._pt, (msg) => this._addLog(msg, 'ability'));
    if (card) {
      this._setStatus(`${this.pg.name} activated ${card.emoji} ${card.name}!`);
      if (typeof GameAudio !== 'undefined') GameAudio.collect();
      this._rebuildWP();
      this.syncUI();
    }
  }

  // ── ROLL BUTTON ─────────────────────────────────────────
  _buildRollBtn(cx, cy, label, color, onClick) {
    const c = this.add.container(cx, cy);
    const w = Math.min(this._W * 0.14, 180);
    const h = 38;

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.85);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 6);
    c.add(bg);

    c.add(this.add.text(0, 0, label, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5));

    if (onClick) {
      const zone = this.add.zone(0, 0, w, h).setOrigin(0.5).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', onClick);
      zone.on('pointerover', () => c.setScale(1.05));
      zone.on('pointerout', () => c.setScale(1));
      c.add(zone);
      c._zone = zone;
    }

    c._bg = bg; c._color = color;
    return c;
  }

  _setFightEnabled(en) {
    if (this._redBtn) { this._redBtn.setAlpha(en ? 1 : 0.3); if (this._redBtn._zone) this._redBtn._zone.input.enabled = en; }
  }

  // ── STATUS BAR ──────────────────────────────────────────
  _setStatus(text) { if (this._statusBar) this._statusBar.setText(text); }

  // ── DICE (3D DOM) ───────────────────────────────────────
  _buildDiceArea() {} // handled by Dice3D DOM overlay

  _showDice(side, values, isWinner) {
    if (typeof Dice3D !== 'undefined' && isWinner !== false) {
      const team = side === 'player' ? 'red' : 'blue';
      if (isWinner) { const res = typeof classify === 'function' ? classify(values) : null; if (res) Dice3D.highlightWin(team, res); }
    }
  }

  _tumbleDice(pV, eV, cb) {
    if (typeof Dice3D !== 'undefined') {
      Dice3D.clear('red'); Dice3D.clear('blue');
      Dice3D.showRolling('red', pV.length);
      Dice3D.showRolling('blue', eV.length);
      this.time.delayedCall(800, () => {
        let done = 0;
        const check = () => { done++; if (done >= 2 && cb) cb(); };
        Dice3D.revealDice('red', pV, check);
        Dice3D.revealDice('blue', eV, check);
      });
    } else { if (cb) this.time.delayedCall(500, cb); }
  }

  // ── CALLOUT ─────────────────────────────────────────────
  _showCallout(text, type, subtitle, dur) {
    dur = dur || 2000;
    const c = this.add.container(this._W/2, this._H/2).setDepth(1000);
    const bd = this.add.graphics();
    bd.fillStyle(0x000000, 0.6);
    bd.fillRect(-this._W/2, -50, this._W, 100);
    c.add(bd);
    const style = { fontFamily: 'Cinzel, Georgia, serif', fontSize: '44px', color: '#ffd700', stroke: '#000', strokeThickness: 4, align: 'center' };
    if (type==='ko') style.color = '#ff3333';
    if (type==='damage') style.color = '#e94560';
    if (type==='heal') style.color = '#4ade80';
    c.add(this.add.text(0, -8, text, style).setOrigin(0.5));
    if (subtitle) { const s = this.add.text(0, 28, subtitle, { fontFamily: 'Georgia, serif', fontSize: '14px', color: BC.TEXT }).setOrigin(0.5); s.setAlpha(0); this.tweens.add({ targets: s, alpha: 1, duration: 300, delay: 200 }); c.add(s); }
    c.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
    this.time.delayedCall(dur, () => { this.tweens.add({ targets: c, alpha: 0, scaleY: 0.5, duration: 250, onComplete: () => c.destroy() }); });
  }

  _showFloat(x, y, text, color) {
    const t = this.add.text(x, y, text, { fontFamily: 'Cinzel, serif', fontSize: '26px', color: color||'#e94560', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: t, y: y-50, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ── LOG ──────────────────────────────────────────────────
  _addLog(text) { this._logEntries.push(text); }

  // ═══════════════════════════════════════════════════════
  //  COMBAT ROUND
  // ═══════════════════════════════════════════════════════
  doRound() {
    if (!B || !this.pg || !this.eg) return;
    if (this.pg.hp <= 0 || this.eg.hp <= 0) return;
    if (this._rolling) return;
    this._rolling = true;
    this.roundNum++;
    this._setFightEnabled(false);
    if (typeof GameAudio !== 'undefined') GameAudio.dice();

    if (typeof triggerPreRoll === 'function') {
      triggerPreRoll(this._pt, (msg) => this._addLog(msg));
      triggerPreRoll(this._et, (msg) => this._addLog(msg));
      this.pg = activeGhost(B[this._pt]); this.eg = activeGhost(B[this._et]);
      this.syncUI();
    }

    if (this.pg.hp <= 0 || this.pg.ko) { this._rolling = false; this.time.delayedCall(600, () => this.checkKOSwap()); return; }
    if (this.eg.hp <= 0 || this.eg.ko) { this._rolling = false; this.time.delayedCall(600, () => this.handleEnemyKO()); return; }

    const pDC = typeof calculateDiceCount === 'function' ? calculateDiceCount(this._pt) : 3;
    const eDC = typeof calculateDiceCount === 'function' ? calculateDiceCount(this._et) : 3;
    const pDice = weightedRoll(B[this._pt], pDC);
    const eDice = weightedRoll(B[this._et], eDC);

    if (B._moonstoneReady && B._moonstoneReady[this._pt] && typeof smartMoonstoneChange === 'function') smartMoonstoneChange(pDice);
    if (B._luckyStoneReady && B._luckyStoneReady[this._pt] && typeof smartLuckyStone === 'function') smartLuckyStone(pDice);

    if (!B.lastRollDiceCount) B.lastRollDiceCount = {};
    B.lastRollDiceCount[this._pt] = pDC; B.lastRollDiceCount[this._et] = eDC;

    this._setStatus('Rolling...');
    this._tumbleDice(pDice, eDice, () => {
      this._showDice('player', pDice, false);
      this._showDice('enemy', eDice, false);
      this.time.delayedCall(200, () => this.resolveDice(pDice, eDice));
    });
  }

  resolveDice(pDice, eDice) {
    const pRes = classify(pDice), eRes = classify(eDice);
    const pF = activeGhost(B[this._pt]), eF = activeGhost(B[this._et]);
    const hectorActive = (pF&&pF.id===96&&!pF.ko)||(eF&&eF.id===96&&!eF.ko);
    const rawW = compareRolls(pRes, eRes, pDice, eDice, hectorActive);
    let winner = rawW;
    if (rawW==='a') winner='red'; else if (rawW==='b') winner='blue'; else if (rawW==='tie') winner=null;

    const pWin = winner==='red'||winner===this._pt;
    const eWin = winner==='blue'||winner===this._et;

    if (typeof RollAnnouncer !== 'undefined') {
      const pA = RollAnnouncer.announce(pRes, pWin, 'red');
      const eA = RollAnnouncer.announce(eRes, eWin, 'blue');
      this._showDice('player', pDice, pWin);
      this._showDice('enemy', eDice, eWin);
      if (typeof Dice3D !== 'undefined') { if (pWin) Dice3D.highlightLose('blue'); else if (eWin) Dice3D.highlightLose('red'); }
      if (pA.shake && pWin) this.cameras.main.shake(pA.shake.duration, pA.shake.intensity);
      if (eA.shake && eWin) this.cameras.main.shake(eA.shake.duration, eA.shake.intensity);
    }

    const rollDesc = `${describeRoll(pRes)} vs ${describeRoll(eRes)}`;

    if (pWin) {
      const dmg = typeof calculateDamage === 'function' ? calculateDamage(this._pt, pRes, pDice) : pRes.damage;
      const dodged = typeof checkSylviaDodge === 'function' && checkSylviaDodge(this._et);
      if (dodged) {
        this._setStatus(`${this.eg.name} dodged! ${rollDesc}`);
        this._showFloat(this._W*0.70, this._H*0.30, 'DODGE!', '#44ddff');
      } else {
        const red = typeof calculateDamageReduction === 'function' ? calculateDamageReduction(this._et, pRes) : 0;
        const fd = Math.max(1, dmg - red);
        wpDamage(this.eg, fd);
        if (this.eg.ko) this.eg.killedBy = this.pg.id;
        this._setStatus(`${this.pg.name} deals ${fd} damage! ${rollDesc}`);
        if (typeof GameAudio !== 'undefined') GameAudio.hit();
        this._showFloat(this._W*0.70, this._H*0.30, `-${fd}`, fd>=4?'#ff3333':'#e94560');
        if (fd >= 4) this.cameras.main.shake(200, 0.01);
        this.reportRaidDamage(fd, pDice);
        if (typeof triggerWinPath === 'function') triggerWinPath(this._pt, pRes);
      }
    } else if (eWin) {
      const dmg = typeof calculateDamage === 'function' ? calculateDamage(this._et, eRes, eDice) : eRes.damage;
      const pDodged = typeof checkSylviaDodge === 'function' && checkSylviaDodge(this._pt);
      if (pDodged) {
        this._setStatus(`${this.pg.name} dodged! ${rollDesc}`);
        this._showFloat(this._W*0.28, this._H*0.30, 'DODGE!', '#44ddff');
      } else {
        const red = typeof calculateDamageReduction === 'function' ? calculateDamageReduction(this._pt, eRes) : 0;
        const fd = Math.max(1, dmg - red);
        wpDamage(this.pg, fd);
        this._setStatus(`${this.eg.name} deals ${fd} damage! ${rollDesc}`);
        if (typeof GameAudio !== 'undefined') GameAudio.hurt();
        this._showFloat(this._W*0.28, this._H*0.30, `-${fd}`, '#e94560');
        if (fd >= 4) this.cameras.main.shake(150, 0.008);
      }
      if (typeof triggerWinPath === 'function') triggerWinPath(this._et, eRes);
      if (typeof triggerOnLoss === 'function') triggerOnLoss(this._pt);
    } else {
      this._setStatus(`Tie! ${rollDesc}`);
    }

    this.syncUI();
    if (typeof resetRoundFlags === 'function') resetRoundFlags();
    this._rolling = false;
    this._setFightEnabled(true);
    this.pg = activeGhost(B[this._pt]); this.eg = activeGhost(B[this._et]);

    if (this.eg && (this.eg.hp<=0||this.eg.ko)) { this._setFightEnabled(false); this.time.delayedCall(600, () => this.handleEnemyKO()); }
    else if (this.pg && (this.pg.hp<=0||this.pg.ko)) { this._setFightEnabled(false); this.time.delayedCall(600, () => this.checkKOSwap()); }
  }

  // ═══════════════════════════════════════════════════════
  //  SYNC UI
  // ═══════════════════════════════════════════════════════
  syncUI() {
    this.pg = activeGhost(B[this._pt]); this.eg = activeGhost(B[this._et]);
    this._updateActiveCard(this._pActive, this.pg);
    this._updateActiveCard(this._eActive, this.eg);
    this._rebuildSideline('red');
    this._rebuildSideline('blue');
    this._rebuildWP();
  }

  // ═══════════════════════════════════════════════════════
  //  KO HANDLING
  // ═══════════════════════════════════════════════════════
  handleEnemyKO() {
    this.eg.ko = true;
    this._showCallout('KO!', 'ko', `${this.eg.name} has fallen!`, 1500);
    this._setStatus(`${this.eg.name} has been defeated!`);
    if (typeof GameAudio !== 'undefined') GameAudio.hit();

    const eT = B[this._et];
    const alive = eT.ghosts.filter((g,i) => i!==eT.activeIdx && !g.ko && g.hp>0);
    if (alive.length > 0) {
      const ni = typeof smartPickSwap === 'function' ? smartPickSwap(this._et) : eT.ghosts.indexOf(alive[0]);
      if (ni >= 0) {
        this.time.delayedCall(1600, () => {
          if (typeof performKOSwap === 'function') performKOSwap(this._et, ni, (m) => this._addLog(m));
          else eT.activeIdx = ni;
          this.eg = activeGhost(eT);
          if (typeof triggerEntry === 'function') triggerEntry(eT, this._et);
          // Rebuild enemy card
          if (this._eActive) this._eActive.destroy();
          this._eActive = this._buildActiveCard(this.eg, 'blue', this._W*0.70, this._H*0.38);
          this.syncUI();
          this._setFightEnabled(true);
          this._setStatus(`${this.eg.name} enters the battle!`);
        });
      }
    } else {
      this.time.delayedCall(1600, () => this._exit(true));
    }
  }

  checkKOSwap() {
    this.pg.ko = true; this.pg.hp = 0;
    this._showCallout('KO!', 'ko', `${this.pg.name} has fallen!`, 1500);

    const pT = B[this._pt];
    const living = [];
    pT.ghosts.forEach((g,i) => { if(!g.ko&&g.hp>0&&i!==pT.activeIdx) living.push({ghost:g,idx:i}); });
    if (living.length === 0) { this.time.delayedCall(1600, () => this._exit(false)); return; }
    this.time.delayedCall(1600, () => this._showKOPicker(living));
  }

  _showKOPicker(living) {
    const o = this.add.container(this._W/2, this._H/2).setDepth(2000);
    const bd = this.add.graphics();
    bd.fillStyle(0x000000, 0.85);
    bd.fillRect(-this._W/2, -this._H/2, this._W, this._H);
    o.add(bd);

    o.add(this.add.text(0, -this._H*0.35, 'YOUR SPIRITKIN HAS FALLEN', {
      fontFamily: 'Cinzel, serif', fontSize: '16px', color: '#ff5544', letterSpacing: 2,
    }).setOrigin(0.5));
    o.add(this.add.text(0, -this._H*0.30, 'Choose a replacement', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#bbb',
    }).setOrigin(0.5));

    const cw = 170, ch = 240, gap = 20;
    const totalW = living.length*(cw+gap)-gap;
    const startX = -totalW/2+cw/2;

    living.forEach((entry, i) => {
      const g = entry.ghost;
      const card = this.add.container(startX+i*(cw+gap), 20);

      const cbg = this.add.graphics();
      cbg.fillStyle(BC.CARD_BG, 1);
      cbg.fillRoundedRect(-cw/2, -ch/2, cw, ch, 8);
      cbg.lineStyle(2, _rarH(g.rarity), 0.8);
      cbg.strokeRoundedRect(-cw/2, -ch/2, cw, ch, 8);
      card.add(cbg);

      const ak = 'ghost_'+g.id;
      if (this.textures.exists(ak)) { const a=this.add.image(0,-30,ak); a.setDisplaySize(cw-16,110); card.add(a); }
      card.add(this.add.text(0, 40, g.name, { fontFamily: 'Cinzel, serif', fontSize: '12px', color: '#fff' }).setOrigin(0.5));
      card.add(this.add.text(0, 58, `♥ ${g.hp}/${g.maxHp}`, { fontFamily: 'Courier New, monospace', fontSize: '11px', color: _hpCol(g.hp,g.maxHp) }).setOrigin(0.5));
      if (g.ability) card.add(this.add.text(0, 76, g.ability, { fontFamily: 'Georgia, serif', fontSize: '10px', color: BC.GOLD }).setOrigin(0.5));

      const z = this.add.zone(0, 0, cw, ch).setOrigin(0.5).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => card.setScale(1.06));
      z.on('pointerout', () => card.setScale(1));
      z.on('pointerdown', () => { this.tweens.add({ targets: card, scaleX: 1.1, scaleY: 1.1, duration: 120, yoyo: true, onComplete: () => { o.destroy(); this._doKOSwap(entry); } }); });
      card.add(z);

      card.setAlpha(0); card.y += 30;
      this.tweens.add({ targets: card, alpha: 1, y: 20, duration: 300, delay: i*80, ease: 'Cubic.easeOut' });
      o.add(card);
    });
  }

  _doKOSwap(entry) {
    if (typeof performKOSwap === 'function') performKOSwap(this._pt, entry.idx, (m) => this._addLog(m));
    else B[this._pt].activeIdx = entry.idx;
    this.pg = activeGhost(B[this._pt]);
    if (typeof triggerEntry === 'function') triggerEntry(B[this._pt], this._pt);
    if (this._pActive) this._pActive.destroy();
    this._pActive = this._buildActiveCard(this.pg, 'red', this._W*0.28, this._H*0.38);
    this.syncUI();
    this._rolling = false;
    this._setFightEnabled(true);
    this._setStatus(`${this.pg.name} enters the battle!`);
  }

  // ═══════════════════════════════════════════════════════
  //  END BATTLE
  // ═══════════════════════════════════════════════════════
  _exit(won) {
    if (typeof Dice3D !== 'undefined') Dice3D.destroy();
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = '';

    let leveledUp = false, xpGain = 0, coinChange = 0;
    const pT = B ? B[this._pt] : null;
    if (pT && pT.resources) G.healingSeeds = pT.resources.healingSeed ?? G.healingSeeds;

    if (won) {
      if (!G.rep) G.rep = { battlesWon:0, craftsCompleted:0, itemsSold:0, essencesCollected:0, raresFound:0 };
      G.rep.battlesWon++;
      coinChange = 1+Math.floor(Math.random()*3);
      G.coins += coinChange;
      const rXP = { common:1, uncommon:2, rare:3, 'ghost-rare':4, legendary:5 };
      xpGain = rXP[this.eg?.rarity]||1;
      if (this.battleData.blackRider) xpGain += 5;
      if (this.battleData.worldBoss) { xpGain += 10; coinChange += 100; }
      G.xp += xpGain;
      const need = G.level*3;
      if (G.xp >= need) { G.level++; G.xp -= need; leveledUp = true; for (const g of G.team) { g.hp=g.maxHp; g.ko=false; } }
      if (typeof checkAndNotifyTitles === 'function') checkAndNotifyTitles();
      if (typeof addProfessionXP === 'function') addProfessionXP('combat', 10);
      if (B?.isHostileNPC && typeof markHostileNPCDefeated === 'function') markHostileNPCDefeated(B.isHostileNPC);
      if (this.battleData.worldBoss) G.worldBossesDefeated = (G.worldBossesDefeated||0)+1;
    } else {
      const pen = Math.min(G.coins, 2+Math.floor(Math.random()*3));
      if (pen > 0) { G.coins -= pen; coinChange = -pen; }
    }

    if (pT) pT.ghosts.forEach((g,i) => { if(G.team[i]){G.team[i].hp=g.hp;G.team[i].ko=g.ko;} });
    G.inBattle = false; B = null;
    if (G.activeBuffs) { G.activeBuffs.forEach(b=>{if(b.fights>0)b.fights--;}); G.activeBuffs=G.activeBuffs.filter(b=>b.fights>0); }
    saveGame();

    const text = won?'VICTORY!':'DEFEAT';
    const type = won?'ability':'ko';
    let sub = '';
    if (won) { sub = `+${xpGain} XP  +${coinChange} Gold`; if (leveledUp) sub += `  LEVEL ${G.level}!`; }
    else if (coinChange < 0) sub = `${coinChange} Gold`;

    this._showCallout(text, type, sub, 2500);
    this.time.delayedCall(2800, () => {
      if (typeof GameAudio !== 'undefined') { won?GameAudio.victory():GameAudio.defeat(); }
      this.cameras.main.fadeOut(300, 0, 0, 0, (cam, p) => {
        if (p >= 1) { this.scene.stop(); this.scene.resume('WorldScene'); const ws=this.scene.get('WorldScene'); if(ws&&ws.cameras) ws.cameras.main.fadeIn(300); }
      });
    });
  }

  reportRaidDamage(dmg, dice) { if (!this._raidId || typeof RaidManager === 'undefined') return; RaidManager.reportDamage(this._raidId, dmg, dice); }
  endBattle(won) { this._exit(won); }
  updateHP() { this.syncUI(); }
  refreshWillpowerStacks() { this._rebuildWP(); }
  renderSideline() { this.syncUI(); }
  buildResourceBar() { this._rebuildWP(); }
  rebuildResourceBar() { this._rebuildWP(); }
  showFloatingText(x,y,t,c) { this._showFloat(x,y,t,c); }
  flashScreen() { this.cameras.main.flash(200); }
  buildRaidPartyStrip() {}
  showRaidFeedEntry() {}
  renderWillpowerStack() { this._rebuildWP(); }
}
