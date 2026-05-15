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
    console.log('[BattleScene] create entered, B=', B ? 'set' : 'NULL', '| returnScene=', this.battleData?.returnScene || 'WorldScene');
    if (!B) { console.warn('[BattleScene] EXIT EARLY: B is null'); this._exit(false); return; }
    if (typeof applyBuffsToBattle === 'function') applyBuffsToBattle();
    if (typeof applyFortuneToBattle === 'function') applyFortuneToBattle();

    this._pt = 'red'; this._et = 'blue';
    const pT = B[this._pt], eT = B[this._et];
    if (!pT || !eT) {
      console.warn('[BattleScene] EXIT EARLY: missing team. pT=', !!pT, 'eT=', !!eT, 'B keys=', Object.keys(B||{}));
      this._exit(false); return;
    }

    // Hide world HUD
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = 'none';

    // Enrich ghosts
    const enrich = g => { if (typeof ALL_CARDS!=='undefined') { const c=ALL_CARDS.find(x=>x.id===g.id); if(c){if(!g.art)g.art=c.art;if(!g.abilityDesc&&c.desc)g.abilityDesc=c.desc;if(!g.ability&&c.ability)g.ability=c.ability;if(!g.rarity&&c.rarity)g.rarity=c.rarity;}} return g; };
    pT.ghosts.forEach(enrich); eT.ghosts.forEach(enrich);

    this.pg = activeGhost(pT); this.eg = activeGhost(eT);

    // No world resource transfer — resources earned in battle only (talents/gear/buffs handle world→battle later)
    if (!this.pg || !this.eg) {
      console.warn('[BattleScene] EXIT EARLY: missing active ghost. pg=', !!this.pg, 'eg=', !!this.eg,
        '| pT.ghosts.length=', pT.ghosts?.length, 'pT.activeIdx=', pT.activeIdx,
        '| eT.ghosts.length=', eT.ghosts?.length, 'eT.activeIdx=', eT.activeIdx);
      this._exit(false); return;
    }

    B.battleStarted = true; this.roundNum = 0; this._rolling = false;
    this._raidId = this.battleData.raidId || null;
    this._logEntries = [];

    this._loadArt(() => this._buildStage());
  }

  _loadArt(cb) {
    const all = [...B[this._pt].ghosts, ...B[this._et].ghosts];
    let n = 0;
    all.forEach(g => { const k='ghost_'+g.id; if(!this.textures.exists(k)){const u=_artUrl(g);if(u){this.load.image(k,u);n++;}} });
    if (n > 0) {
      // Safety: fire cb at most once, and fall through after 2s in case
      // Phaser's loader 'complete' event never fires (cross-origin hangs
      // on art URLs have been observed under Phaser 4). Battle renders
      // placeholder art if a texture missed but never deadlocks.
      let fired = false;
      const safe = () => { if (fired) return; fired = true; console.log('[BattleScene] _loadArt cb firing'); cb(); };
      this.load.on('loaderror', () => {});
      this.load.once('complete', safe);
      this.time.delayedCall(2000, safe);
      this.load.start();
    } else cb();
  }

  // ═══════════════════════════════════════════════════════════
  //  BUILD THE STAGE — Testroom layout
  // ═══════════════════════════════════════════════════════════
  _buildStage() {
    console.log('[BattleScene] _buildStage entered');
    try {
      this._doBuildStage();
      console.log('[BattleScene] _buildStage completed');
    } catch (e) {
      console.error('[BattleScene] _buildStage threw:', e, e?.stack);
      // Force-exit so user isn't stuck if the stage build threw silently.
      this._exit(false);
    }
  }
  _doBuildStage() {
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
    this._redBtn = this._buildRollBtn(W * 0.5, H * 0.93, 'ROLL', BC.RED, () => this.doRound());

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

    // Card dimensions — BIGGER, fill the screen properly
    const cw = Math.round(this._W * 0.24);
    const ch = Math.round(cw * 1.4);
    const pad = 10;

    // Card background with thicker team border
    const bg = this.add.graphics();
    bg.fillStyle(BC.CARD_BG, 0.95);
    bg.fillRoundedRect(-cw/2, -ch/2, cw, ch, 12);
    bg.lineStyle(3, tCol, 0.9);
    bg.strokeRoundedRect(-cw/2, -ch/2, cw, ch, 12);
    c.add(bg);

    // Name at top — larger font
    c.add(this.add.text(0, -ch/2 + 20, ghost.name, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '20px', color: BC.TEXT, fontStyle: 'bold',
    }).setOrigin(0.5));

    // Art — PRESERVE ASPECT RATIO, fit within frame
    const artFrameW = cw - pad * 2;
    const artFrameH = ch * 0.52;
    const artY = -ch/2 + 44 + artFrameH/2;
    const artKey = 'ghost_' + ghost.id;
    if (this.textures.exists(artKey)) {
      const art = this.add.image(0, artY, artKey);
      // Preserve aspect ratio: fit within frame
      const srcW = art.width || artFrameW;
      const srcH = art.height || artFrameH;
      const scale = Math.min(artFrameW / srcW, artFrameH / srcH);
      art.setScale(scale);
      c.add(art);
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(_rarH(ghost.rarity), 0.15);
      ph.fillRect(-artFrameW/2, artY - artFrameH/2, artFrameW, artFrameH);
      c.add(ph);
      c.add(this.add.text(0, artY, ghost.name.substring(0,8).toUpperCase(), {
        fontFamily: 'Cinzel, serif', fontSize: '24px', color: _rarS(ghost.rarity),
      }).setOrigin(0.5));
    }

    // Ability badge — wider, more prominent
    const badgeY = artY + artFrameH/2 + 20;
    const badgeW = Math.min(cw * 0.7, 140);
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(tCol, 0.9);
    badgeBg.fillRoundedRect(-badgeW/2, badgeY - 12, badgeW, 24, 5);
    c.add(badgeBg);
    c.add(this.add.text(0, badgeY, (ghost.ability || '').toUpperCase(), {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '11px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Ability description — readable
    c.add(this.add.text(0, badgeY + 26, ghost.abilityDesc || '', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#aab0c0',
      align: 'center', wordWrap: { width: cw - 20 }, lineSpacing: 3,
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
    const cw = Math.round(this._W * 0.13);
    const ch = Math.round(cw * 1.6);
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

    // Art — preserve aspect ratio
    const artFrameH = ch * 0.45;
    const artFrameW = cw - 8;
    const artKey = 'ghost_' + ghost.id;
    if (this.textures.exists(artKey)) {
      const art = this.add.image(0, artFrameH/2 + 4, artKey);
      const srcW = art.width || artFrameW;
      const srcH = art.height || artFrameH;
      const scale = Math.min(artFrameW / srcW, artFrameH / srcH);
      art.setScale(scale);
      if (isKO) art.setTint(0x333344);
      c.add(art);
    }

    // Name
    c.add(this.add.text(0, artFrameH + 10, ghost.name, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '10px', color: isKO ? '#555' : BC.TEXT,
    }).setOrigin(0.5));

    // Ability badge
    const abilY = artFrameH + 24;
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

  // ── WILLPOWER BAR — health bar + willpower cards unified ────
  // Each willpower card is a segment of the health bar.
  // Together they ARE the bar. Lose a card, the bar shrinks.
  // Beginners see a red health bar with hearts. Experienced players
  // see colored segments with icons for their special cards.
  _buildWPArea(team, cx, cy) {
    const c = this.add.container(cx, cy);
    const tKey = team === 'red' ? this._pt : this._et;
    const t = B[tKey];
    const ghost = activeGhost(t);
    if (!ghost) return c;

    const hand = ghost.willpower || [];
    const maxHp = ghost.maxHp || hand.length || 1;
    const isAllHearts = hand.length > 0 && hand.every(id => id === 0);
    const wpUsed = B.wpUsedThisTurn && B.wpUsedThisTurn[tKey];

    // ── Bar dimensions — fixed width based on maxHp, segments fill it ──
    const barW = Math.min(this._W * 0.28, 340);
    const barH = 36;
    const segW = (barW - 2) / maxHp; // segment width fills the track evenly
    const segGap = 1.5; // tiny hairline between segments
    const barR = 6; // border radius

    // ── Dark track background (shows maxHp capacity) ──
    const track = this.add.graphics();
    track.fillStyle(0x0a0a14, 0.9);
    track.fillRoundedRect(-barW / 2, -barH / 2, barW, barH, barR);
    track.lineStyle(1.5, 0x222244, 0.6);
    track.strokeRoundedRect(-barW / 2, -barH / 2, barW, barH, barR);
    c.add(track);

    // ── Ghost segments for lost HP (dim empty slots) ──
    for (let i = hand.length; i < maxHp; i++) {
      const sx = -barW / 2 + 1 + i * segW;
      const empty = this.add.graphics();
      empty.fillStyle(0x1a0a0a, 0.4);
      empty.fillRect(sx + segGap / 2, -barH / 2 + 1, segW - segGap, barH - 2);
      c.add(empty);
    }

    // Color map for willpower card types
    const WP_FILLS = { red: 0xc0392b, blue: 0x2980b9, green: 0x27ae60, orange: 0xd4790e };
    const WP_BORDERS = { red: 0xe94560, blue: 0x4cc9f0, green: 0x2ecc71, orange: 0xf39c12 };

    // ── Draw each living willpower segment ──
    hand.forEach((cardId, i) => {
      const wp = typeof wpCardById === 'function' ? wpCardById(cardId) : null;
      const sx = -barW / 2 + 1 + i * segW;
      const isTop = (i === 0);
      const isSpecial = cardId !== 0;
      const canActivate = isTop && isSpecial && !wpUsed && team === 'red';

      const seg = this.add.graphics();

      if (isAllHearts) {
        // ── Beginner: solid red health segments ──
        const hpPct = ghost.hp / maxHp;
        const fillCol = hpPct > 0.5 ? 0xc0392b : hpPct > 0.25 ? 0xc49922 : 0x991111;
        seg.fillStyle(fillCol, 0.92);
        seg.fillRect(sx + segGap / 2, -barH / 2 + 1, segW - segGap, barH - 2);
      } else if (isSpecial) {
        // ── Special card: colored segment ──
        const fillCol = WP_FILLS[wp?.color] || 0x8844aa;
        seg.fillStyle(fillCol, 0.9);
        seg.fillRect(sx + segGap / 2, -barH / 2 + 1, segW - segGap, barH - 2);
        // Bright top edge accent
        const borderCol = WP_BORDERS[wp?.color] || 0xd4a040;
        seg.fillStyle(borderCol, 0.5);
        seg.fillRect(sx + segGap / 2, -barH / 2 + 1, segW - segGap, 3);
        // Pulsing glow for activatable top card
        if (canActivate) {
          const glow = this.add.graphics();
          glow.fillStyle(borderCol, 0.2);
          glow.fillRoundedRect(sx - 2, -barH / 2 - 3, segW + 4, barH + 6, 4);
          c.add(glow);
          this.tweens.add({ targets: glow, alpha: 0.4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      } else {
        // ── Heart in mixed deck: darker red, quieter ──
        seg.fillStyle(0x8b2020, 0.75);
        seg.fillRect(sx + segGap / 2, -barH / 2 + 1, segW - segGap, barH - 2);
      }
      c.add(seg);

      // ── Icon inside each segment ──
      const iconX = sx + segW / 2;
      if (isAllHearts) {
        // Only show ♥ on segments wide enough to read
        if (segW >= 20) {
          c.add(this.add.text(iconX, 0, '♥', {
            fontFamily: 'Georgia, serif', fontSize: segW >= 35 ? '18px' : '14px', color: '#ff9999',
          }).setOrigin(0.5).setAlpha(0.7));
        }
      } else {
        const emoji = wp ? wp.emoji : '♥';
        if (segW >= 18) {
          c.add(this.add.text(iconX, 0, emoji, {
            fontFamily: 'sans-serif', fontSize: segW >= 35 ? '17px' : segW >= 25 ? '14px' : '11px',
          }).setOrigin(0.5));
        }
      }
    });

    // ── HP number overlay (centered on bar) ──
    const hpCol = _hpCol(ghost.hp, ghost.maxHp);
    c.add(this.add.text(barW / 2 + 10, 0, `${ghost.hp}/${maxHp}`, {
      fontFamily: 'Cinzel, serif', fontSize: '16px', color: hpCol, fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // ── Label above bar ──
    const labelY = -barH / 2 - 12;
    if (isAllHearts || hand.length === 0) {
      c.add(this.add.text(0, labelY, '♥ HEALTH', {
        fontFamily: 'Cinzel, Georgia, serif', fontSize: '10px', color: '#cc4444', letterSpacing: 2,
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(0, labelY, '✦ WILLPOWER', {
        fontFamily: 'Cinzel, Georgia, serif', fontSize: '10px', color: BC.GOLD, letterSpacing: 2,
      }).setOrigin(0.5));
    }

    // ── Deck info (mixed decks only, subtle) ──
    if (!isAllHearts && hand.length > 0) {
      c.add(this.add.text(barW / 2 + 10, 14, `deck ${t.wpDeck ? t.wpDeck.length : 0}`, {
        fontFamily: 'Courier New, monospace', fontSize: '7px', color: '#4a4a60',
      }).setOrigin(0, 0.5));
    }

    // ── Click first segment to activate willpower (player only) ──
    if (team === 'red' && hand.length > 0) {
      const firstSegX = -barW / 2 + 1 + segW / 2;
      const wpZone = this.add.zone(firstSegX, 0, segW + 4, barH + 4)
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      wpZone.on('pointerdown', () => {
        const topId = ghost.willpower && ghost.willpower[0];
        if (topId === 0) {
          this._setStatus('♥ Heart — basic willpower, no effect');
          return;
        }
        this._activateWillpower();
      });
      c.add(wpZone);
    }

    // ── Resources below bar ──
    const res = t.resources || {};
    const RDISPLAY = typeof RESOURCE_DISPLAY !== 'undefined' ? RESOURCE_DISPLAY : {};
    const committable = ['ice', 'fire', 'surge'];
    let rx = -barW / 2;
    Object.entries(RDISPLAY).forEach(([key, cfg]) => {
      const count = res[key] || 0;
      if (count <= 0) return;
      const committed = (B.committed && B.committed[tKey] && B.committed[tKey][key]) || 0;
      const label = committed > 0 ? `${cfg.emoji}${count}(${committed})` : `${cfg.emoji}${count}`;

      const resTxt = this.add.text(rx, barH / 2 + 10, label, {
        fontFamily: 'sans-serif', fontSize: '12px', color: cfg.color || BC.TEXT,
        backgroundColor: committed > 0 ? '#2a1a00cc' : '#0a0a14aa',
        padding: { x: 3, y: 1 },
      }).setOrigin(0, 0.5);
      c.add(resTxt);

      if (team === 'red') {
        const resZone = this.add.zone(rx + 18, barH / 2 + 10, 40, 20).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        resZone.on('pointerdown', () => {
          if (this._rolling) return;
          if (committable.includes(key) && typeof cycleCommit === 'function') {
            cycleCommit(tKey, key);
            this._rebuildWP();
            this._setStatus(`Committed ${cfg.label}!`);
          } else if (key === 'moonstone' && typeof useMoonstone === 'function') {
            useMoonstone(tKey, (msg) => this._setStatus(msg));
            this._rebuildWP();
          } else if (key === 'luckyStone' && typeof useLuckyStone === 'function') {
            useLuckyStone(tKey, (msg) => this._setStatus(msg));
            this._rebuildWP();
          } else if (key === 'healingSeed' && typeof spendHealingSeed === 'function') {
            spendHealingSeed(tKey, (msg) => this._setStatus(msg));
            this._rebuildWP();
            this.syncUI();
          }
        });
        c.add(resZone);
      }
      rx += 42;
    });

    return c;
  }

  _rebuildWP() {
    if (this._pWPArea) this._pWPArea.destroy();
    if (this._eWPArea) this._eWPArea.destroy();
    this._pWPArea = this._buildWPArea('red', this._W * 0.18, this._H * 0.82);
    this._eWPArea = this._buildWPArea('blue', this._W * 0.82, this._H * 0.82);
  }

  // ── WILLPOWER CARD ANIMATIONS ───────────────────────────

  // Cards fly off when damage is dealt — fire-and-forget overlay
  _animateCardLoss(side, count) {
    if (count <= 0) return;
    const isPlayer = side === 'red' || side === this._pt;
    const cx = isPlayer ? this._W * 0.18 : this._W * 0.82;
    const cy = this._H * 0.82;
    const flyDir = isPlayer ? -1 : 1; // fly left for player, right for enemy

    for (let i = 0; i < count; i++) {
      const card = this.add.graphics().setDepth(900);
      card.fillStyle(0x8b2020, 0.9);
      card.fillRoundedRect(-14, -19, 28, 38, 4);
      card.lineStyle(1, 0xff4444, 0.6);
      card.strokeRoundedRect(-14, -19, 28, 38, 4);
      card.setPosition(cx + (i - count/2) * 12, cy);

      const heart = this.add.text(cx + (i - count/2) * 12, cy - 2, '♥', {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ff6666',
      }).setOrigin(0.5).setDepth(901);

      const delay = i * 60;
      const driftX = flyDir * (30 + Math.random() * 40);
      this.tweens.add({
        targets: [card, heart],
        y: cy - 50 - Math.random() * 25,
        x: `+=${driftX}`,
        alpha: 0,
        angle: flyDir * (15 + Math.random() * 20),
        scaleX: 0.4, scaleY: 0.4,
        duration: 450,
        delay,
        ease: 'Cubic.easeOut',
        onComplete: () => { card.destroy(); heart.destroy(); }
      });
    }
  }

  // Cards slide in when healing occurs
  _animateCardGain(side, count) {
    if (count <= 0) return;
    const isPlayer = side === 'red' || side === this._pt;
    const cx = isPlayer ? this._W * 0.18 : this._W * 0.82;
    const cy = this._H * 0.82;

    for (let i = 0; i < count; i++) {
      const card = this.add.graphics().setDepth(900);
      card.fillStyle(0x1a5c2a, 0.9);
      card.fillRoundedRect(-14, -19, 28, 38, 4);
      card.lineStyle(1, 0x4ade80, 0.6);
      card.strokeRoundedRect(-14, -19, 28, 38, 4);
      card.setPosition(cx + (i - count/2) * 12, cy + 50);
      card.setAlpha(0);

      const heart = this.add.text(cx + (i - count/2) * 12, cy + 48, '♥', {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#4ade80',
      }).setOrigin(0.5).setDepth(901).setAlpha(0);

      const delay = i * 70;
      this.tweens.add({
        targets: [card, heart],
        y: cy,
        alpha: 1,
        duration: 350,
        delay,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: [card, heart], alpha: 0, duration: 200, delay: 150, onComplete: () => { card.destroy(); heart.destroy(); } });
        }
      });
    }
  }

  // Burst flash when a willpower card is activated
  _animateActivation(emoji, color) {
    const cx = this._W * 0.18;
    const cy = this._H * 0.82;
    const colorHex = color === 'red' ? 0xe94560 : color === 'blue' ? 0x4cc9f0 : color === 'green' ? 0x27ae60 : 0xf39c12;

    // Ring burst
    const ring = this.add.graphics().setDepth(950);
    ring.lineStyle(3, colorHex, 0.8);
    ring.strokeCircle(cx, cy, 8);
    this.tweens.add({
      targets: ring, scaleX: 3, scaleY: 3, alpha: 0,
      duration: 400, ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });

    // Emoji flies up big
    const emText = this.add.text(cx, cy, emoji, {
      fontFamily: 'sans-serif', fontSize: '28px',
    }).setOrigin(0.5).setDepth(951);
    this.tweens.add({
      targets: emText, y: cy - 45, scaleX: 1.5, scaleY: 1.5, alpha: 0,
      duration: 600, ease: 'Cubic.easeOut',
      onComplete: () => emText.destroy()
    });
  }

  _activateWillpower() {
    if (this._rolling) { console.log('[WP] Blocked: rolling'); return; }
    if (typeof activateWillpower !== 'function') { console.log('[WP] activateWillpower not found'); return; }

    const ghost = activeGhost(B[this._pt]);
    const topId = ghost && ghost.willpower && ghost.willpower.length > 0 ? ghost.willpower[0] : null;
    const topCard = topId !== null && typeof wpCardById === 'function' ? wpCardById(topId) : null;
    console.log('[WP] Attempting activation. Top card:', topCard ? topCard.name : 'none',
      'HP:', ghost ? ghost.hp : '?', 'Cost:', topCard ? (topCard.hpCost || 1) : '?',
      'Used this turn:', B.wpUsedThisTurn ? B.wpUsedThisTurn[this._pt] : false);

    const card = activateWillpower(this._pt, this._pt, (msg) => {
      console.log('[WP] Log:', msg);
      this._addLog(msg);
    });

    if (card) {
      console.log('[WP] Activated:', card.name, '→', card.effect);
      this._animateActivation(card.emoji, card.color);
      this._setStatus(`${this.pg.name} activated ${card.emoji} ${card.name}!`);
      if (typeof GameAudio !== 'undefined') GameAudio.collect();
      this._rebuildWP();
      this.syncUI();
    } else {
      console.log('[WP] Activation returned null — blocked or failed');
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

    // Pepo auto-flick: change lowest die to match the most common value (simplified Charlie mode)
    if (B.wpPepo && B.wpPepo[this._pt]) {
      B.wpPepo[this._pt] = false;
      const counts = {};
      pDice.forEach(d => counts[d] = (counts[d] || 0) + 1);
      const bestVal = +Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
      let changed = false;
      for (let i = 0; i < pDice.length; i++) {
        if (pDice[i] !== bestVal) { pDice[i] = bestVal; changed = true; break; }
      }
      pDice.sort((a, b) => a - b);
      if (changed) this._setStatus('Pepo flicked a die!');
    }
    // Enemy Pepo
    if (B.wpPepo && B.wpPepo[this._et]) {
      B.wpPepo[this._et] = false;
      const counts = {};
      eDice.forEach(d => counts[d] = (counts[d] || 0) + 1);
      const bestVal = +Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
      for (let i = 0; i < eDice.length; i++) {
        if (eDice[i] !== bestVal) { eDice[i] = bestVal; break; }
      }
      eDice.sort((a, b) => a - b);
    }

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
        this._animateCardLoss(this._et, fd);
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
        this._animateCardLoss(this._pt, fd);
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

    // Detect heals since last sync — animate card gains
    const prevP = this._lastSyncPHP || 0;
    const prevE = this._lastSyncEHP || 0;
    const curP = this.pg ? this.pg.hp : 0;
    const curE = this.eg ? this.eg.hp : 0;
    if (curP > prevP && prevP > 0) this._animateCardGain(this._pt, curP - prevP);
    if (curE > prevE && prevE > 0) this._animateCardGain(this._et, curE - prevE);
    this._lastSyncPHP = curP;
    this._lastSyncEHP = curE;

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
      // Skip the default loss penalty inside dungeons — the dungeon's own
      // goldLossOnFail handles that (avoid double-tax). See DungeonScene.
      if (!this.battleData.dungeon) {
        const pen = Math.min(G.coins, 2+Math.floor(Math.random()*3));
        if (pen > 0) { G.coins -= pen; coinChange = -pen; }
      }
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
        if (p >= 1) {
          // Return to whichever scene launched the battle (defaults to WorldScene).
          const target = this.battleData.returnScene || 'WorldScene';
          this.scene.stop();
          this.scene.resume(target);
          const rs = this.scene.get(target);
          if (rs && rs.cameras) rs.cameras.main.fadeIn(300);
        }
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
