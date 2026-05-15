// ══════════════════════════════════════════════════════════
//  TALENT SCENE — Journal / Tome aesthetic
//  Bottom-to-top: Apprentice → Tier 0-3 → Master
//  All trees viewable (locked ones are read-only)
// ══════════════════════════════════════════════════════════

const TUI = {
  BG:         0x0e1528,
  SURFACE:    0x161c2e,
  PARCHMENT:  0x1e2438,
  GOLD:       0xd4a040,
  GOLD_S:     '#d4a040',
  TEXT:        '#f0e8d4',
  DIM:         '#6a6a80',
  FONT_TITLE:  'Cinzel, Georgia, serif',
  FONT_BODY:   'Georgia, serif',
};

// Category mapping for the chapter index
const TREE_CATEGORIES = {
  'SPIRIT ARTS':    ['fortune_teller', 'shaman', 'scholar', 'enchanter'],
  'CRAFTSMANSHIP':  ['artisan', 'architect', 'armorsmith', 'weaponsmith'],
  'CULTIVATION':    ['cultivator', 'botanist', 'pet_keeper', 'terraformer'],
  'BEAST MASTERY':  ['trainer', 'beastmaster', 'gladiator', 'ranger'],
  'SCIENCE':        ['scientist', 'alchemist', 'gene_splicer', 'inventor'],
  'HIDDEN':         ['dark_rider', 'shadow_knight', 'nightmare', 'wraith',
                     'elder', 'sage', 'arbiter', 'lorekeeper'],
};

class TalentScene extends Phaser.Scene {
  constructor() { super('TalentScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this._dyn = [];
    this._sideDyn = [];
    this._selectedTree = null;
    this._tooltip = null;
    this._pulseTweens = [];

    this.input.mouse.disableContextMenu();

    // ── Full-screen dark blue backdrop ──
    this.add.rectangle(W / 2, H / 2, W, H, TUI.BG).setDepth(0);

    // ── Gold-bordered inner frame ──
    const frameGfx = this.add.graphics().setDepth(1);
    frameGfx.lineStyle(1, TUI.GOLD, 0.6);
    frameGfx.strokeRect(20, 20, W - 40, H - 40);
    // Inner double-line accent
    frameGfx.lineStyle(1, TUI.GOLD, 0.15);
    frameGfx.strokeRect(24, 24, W - 48, H - 48);

    // ── Title: Tome of Knowledge ──
    this.add.text(W / 2, 10, 'Tome of Knowledge', {
      fontSize: '20px', fontFamily: TUI.FONT_TITLE, color: TUI.GOLD_S,
    }).setOrigin(0.5, 0).setDepth(3);

    // ── Close button ──
    const closeBtn = this.add.text(W - 36, 10, '\u2715', {
      fontSize: '18px', fontFamily: TUI.FONT_TITLE, color: '#886644',
    }).setOrigin(0.5, 0).setDepth(4).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffcc88'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#886644'));
    closeBtn.on('pointerdown', () => this._close());

    // ESC to close
    this.input.keyboard.on('keydown-ESC', () => this._close());

    // ── Left Panel constants ──
    this._sideW = 220;
    this._mainX = this._sideW + 4;

    // Left panel background
    this.add.rectangle(this._sideW / 2 + 20, H / 2, this._sideW - 4, H - 48, TUI.SURFACE, 0.95)
      .setDepth(1);
    // Gold left border accent
    const sideAccent = this.add.graphics().setDepth(2);
    sideAccent.lineStyle(2, TUI.GOLD, 0.4);
    sideAccent.beginPath();
    sideAccent.moveTo(this._sideW + 18, 24);
    sideAccent.lineTo(this._sideW + 18, H - 24);
    sideAccent.strokePath();

    // ── Respec button (bottom of sidebar) ──
    const respecY = H - 50;
    const respecW = this._sideW - 32;
    const respecBg = this.add.rectangle(this._sideW / 2 + 20, respecY, respecW, 28, 0x2a1520, 0.9)
      .setStrokeStyle(1, 0x663344).setDepth(3).setInteractive({ useHandCursor: true });
    const respecTxt = this.add.text(this._sideW / 2 + 20, respecY, 'SURRENDER ALL', {
      fontSize: '10px', fontFamily: TUI.FONT_TITLE, fontStyle: 'bold', color: '#cc6666',
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(4);
    respecBg.on('pointerdown', () => this._respecCurrent());
    respecBg.on('pointerover', () => { respecBg.setFillStyle(0x3a2030); respecTxt.setColor('#ff8888'); });
    respecBg.on('pointerout', () => { respecBg.setFillStyle(0x2a1520); respecTxt.setColor('#cc6666'); });

    // ── Bottom XP Bar ──
    this._buildBottomBar();

    // ── Build sidebar + select first tree ──
    this._buildSidebar();
    const firstTree = Object.keys(CLASS_TREES)[0];
    if (firstTree) this._selectTree(firstTree);
    this._updatePoints();

    // ── First-visit intro overlay ──
    if (!G._talentVisited) {
      this._showFirstVisitOverlay();
    }
  }

  _showFirstVisitOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'talent-intro-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:50000;
      background:rgba(0,0,0,0.75);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      font-family:'Cinzel',Georgia,serif;
      cursor:pointer; user-select:none;
    `;

    const title = document.createElement('div');
    title.textContent = 'TALENT TREES';
    title.style.cssText = `
      font-size:28px; color:#d4a040; letter-spacing:3px;
      margin-bottom:18px; text-shadow:0 2px 8px rgba(0,0,0,0.6);
    `;
    overlay.appendChild(title);

    const body = document.createElement('div');
    body.textContent = 'Spend points to unlock new abilities. Browse the trees on the left and click any talent to learn more.';
    body.style.cssText = `
      font-size:15px; color:#f0e8d4; max-width:420px; text-align:center;
      line-height:1.5; font-family:Georgia,serif;
      margin-bottom:28px;
    `;
    overlay.appendChild(body);

    const hint = document.createElement('div');
    hint.textContent = 'Click to continue';
    hint.style.cssText = `
      font-size:12px; color:#6a6a80; letter-spacing:2px;
      animation: talentPulse 2s ease-in-out infinite;
    `;
    overlay.appendChild(hint);

    // Pulse animation
    const style = document.createElement('style');
    style.textContent = `@keyframes talentPulse { 0%,100%{opacity:.5} 50%{opacity:1} }`;
    overlay.appendChild(style);

    overlay.addEventListener('click', () => {
      overlay.remove();
      G._talentVisited = true;
      if (typeof saveGame === 'function') saveGame();
    }, { once: true });

    document.body.appendChild(overlay);
  }

  // ══════════════════════════════════════════════════════════
  //  BOTTOM BAR — Profession XP totals
  // ══════════════════════════════════════════════════════════

  _buildBottomBar() {
    const W = this.scale.width;
    const H = this.scale.height;
    const barY = H - 16;

    // Dark strip
    this.add.rectangle(W / 2, H - 14, W - 40, 28, TUI.SURFACE, 0.8).setDepth(2);

    const xpTypes = [
      { key: 'combat',      icon: '\u2694', label: 'Combat',    color: '#ee6644' },
      { key: 'exploration',  icon: '\uD83E\uDDED', label: 'Explore',   color: '#44bbff' },
      { key: 'crafting',    icon: '\uD83D\uDD28', label: 'Craft',     color: '#dd9933' },
      { key: 'trade',       icon: '\uD83D\uDCB0', label: 'Trade',     color: '#66cc66' },
      { key: 'charisma',    icon: '\u2728', label: 'Charisma',  color: '#bb66dd' },
    ];

    const startX = this._mainX + 40;
    const spacing = (W - this._mainX - 80) / xpTypes.length;
    this._xpTexts = [];

    for (let i = 0; i < xpTypes.length; i++) {
      const x = startX + spacing * i + spacing / 2;
      const xp = xpTypes[i];
      const val = (G.professionXP && G.professionXP[xp.key]) || 0;
      const txt = this.add.text(x, barY, xp.icon + ' ' + xp.label + ': ' + val, {
        fontSize: '11px', fontFamily: TUI.FONT_BODY, color: xp.color,
      }).setOrigin(0.5).setDepth(3);
      this._xpTexts.push({ text: txt, key: xp.key, icon: xp.icon, label: xp.label, color: xp.color });
    }
  }

  _refreshBottomBar() {
    if (!this._xpTexts) return;
    for (const entry of this._xpTexts) {
      const val = (G.professionXP && G.professionXP[entry.key]) || 0;
      entry.text.setText(entry.icon + ' ' + entry.label + ': ' + val);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  SIDEBAR — Chapter Index
  // ══════════════════════════════════════════════════════════

  _buildSidebar() {
    this._sideDyn.forEach(o => o.destroy());
    this._sideDyn = [];
    this._sidebarTabs = [];

    const H = this.scale.height;
    const padL = 28;
    const tabH = 34;
    const gap = 1;
    const headerGap = 6;
    let y = 48;

    for (const [category, treeIds] of Object.entries(TREE_CATEGORIES)) {
      // Filter to only trees that exist in CLASS_TREES
      const validIds = treeIds.filter(id => CLASS_TREES[id]);
      if (validIds.length === 0) continue;

      // Check if any tree in the category should be shown
      // For HIDDEN, only show category if at least one hidden tree is revealed
      if (category === 'HIDDEN') {
        const anyVisible = validIds.some(id => {
          const tree = CLASS_TREES[id];
          if (!tree.hidden) return true;
          if (tree.hidden === 'darkRider' && G.darkRiderUnlocked) return true;
          if (tree.hidden === 'elder' && G.elderUnlocked) return true;
          return false;
        });
        // Always show HIDDEN section header but only show ??? entries
      }

      // Category header
      const hdr = this.add.text(padL, y, category, {
        fontSize: '9px', fontFamily: TUI.FONT_TITLE, color: TUI.DIM,
        letterSpacing: 2,
      }).setDepth(3);
      this._sideDyn.push(hdr);
      y += 16;

      for (const treeId of validIds) {
        const tree = CLASS_TREES[treeId];
        const visible = isTreeVisible(treeId);
        const isSubTree = !!tree.requiresTree;
        const isHidden = !!tree.hidden;

        // Hide sub-trees of hidden parents until parent is unlocked
        if (isSubTree && isHidden) {
          const parentTree = CLASS_TREES[tree.requiresTree];
          const parentUnlocked = parentTree && !parentTree.hidden ? true :
            (parentTree && parentTree.hidden === 'darkRider' && G.darkRiderUnlocked) ||
            (parentTree && parentTree.hidden === 'elder' && G.elderUnlocked);
          if (!parentUnlocked) continue;
        }

        let displayName, displayColor, isSecret;
        if (isHidden && !visible && !isSubTree) {
          displayName = '???';
          displayColor = TUI.DIM;
          isSecret = true;
        } else if (isSubTree && !visible) {
          displayName = tree.name;
          displayColor = '#444460';
          isSecret = false;
        } else {
          displayName = tree.name;
          displayColor = tree.color;
          isSecret = false;
        }

        const indent = isSubTree ? 20 : 0;
        const itemX = padL + indent;
        const itemW = this._sideW - 24;

        // Tab background
        const bg = this.add.rectangle(this._sideW / 2 + 20, y + tabH / 2, itemW, tabH, TUI.PARCHMENT, 0.5)
          .setDepth(2).setInteractive({ useHandCursor: true });
        this._sideDyn.push(bg);

        // 3px left color border
        const borderGfx = this.add.graphics().setDepth(3);
        const treeColor = Phaser.Display.Color.HexStringToColor(displayColor).color;
        borderGfx.fillStyle(treeColor, 0.8);
        borderGfx.fillRect(padL - 4, y + 2, 3, tabH - 4);
        this._sideDyn.push(borderGfx);

        // Sub-tree connector
        if (isSubTree) {
          const conn = this.add.text(padL + 4, y + 4, '\u2514', {
            fontSize: '11px', fontFamily: TUI.FONT_BODY, color: TUI.DIM,
          }).setDepth(3);
          this._sideDyn.push(conn);
        }

        // Tree name
        const nameStyle = {
          fontSize: '13px', fontFamily: TUI.FONT_BODY, color: displayColor,
        };
        if (isSecret) nameStyle.fontStyle = 'italic';
        const label = this.add.text(itemX + (isSubTree ? 16 : 0), y + 6, displayName, nameStyle).setDepth(3);
        this._sideDyn.push(label);

        // Progress text (right-aligned)
        const pts = this.add.text(this._sideW + 10, y + 10, '', {
          fontSize: '10px', fontFamily: TUI.FONT_BODY, color: TUI.DIM,
        }).setOrigin(1, 0).setDepth(3);
        this._sideDyn.push(pts);

        // Interactions
        bg.on('pointerdown', () => this._selectTree(treeId));
        bg.on('pointerover', () => { if (this._selectedTree !== treeId) bg.setFillStyle(0x283050); });
        bg.on('pointerout', () => { if (this._selectedTree !== treeId) bg.setFillStyle(TUI.PARCHMENT); });

        this._sidebarTabs.push({ treeId, bg, label, pts, visible, borderGfx, displayColor });
        y += tabH + gap;
      }
      y += headerGap;
    }
  }

  _refreshSidebar() {
    let changed = false;
    for (const tab of this._sidebarTabs) {
      const nowVisible = isTreeVisible(tab.treeId);
      if (nowVisible !== tab.visible) { changed = true; break; }
    }
    if (changed) this._buildSidebar();
    this._updateSidebarPoints();
    this._highlightSidebarTab(this._selectedTree);
  }

  _updateSidebarPoints() {
    for (const tab of this._sidebarTabs) {
      const spent = getTreePointsSpent(tab.treeId);
      const maxPts = getTreeMaxPoints(tab.treeId);
      if (spent > 0) {
        const mastered = isMaster(tab.treeId);
        tab.pts.setText(mastered ? 'MASTERED' : spent + '/' + maxPts);
        tab.pts.setColor(mastered ? '#88ff88' : TUI.DIM);
      } else {
        tab.pts.setText('');
      }
    }
  }

  _highlightSidebarTab(treeId) {
    for (const tab of this._sidebarTabs) {
      if (tab.treeId === treeId) {
        tab.bg.setFillStyle(0x283050);
        tab.bg.setAlpha(0.9);
        // Bright gold left border for active
        tab.borderGfx.clear();
        tab.borderGfx.fillStyle(TUI.GOLD, 1);
        tab.borderGfx.fillRect(24, tab.bg.y - tab.bg.height/2 + 2, 3, tab.bg.height - 4);
      } else {
        tab.bg.setFillStyle(TUI.PARCHMENT);
        tab.bg.setAlpha(0.5);
        // Restore tree color border
        const c = Phaser.Display.Color.HexStringToColor(tab.displayColor).color;
        tab.borderGfx.clear();
        tab.borderGfx.fillStyle(c, 0.8);
        tab.borderGfx.fillRect(24, tab.bg.y - tab.bg.height/2 + 2, 3, tab.bg.height - 4);
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TREE SELECTION & RENDERING
  // ══════════════════════════════════════════════════════════

  _selectTree(treeId) {
    this._selectedTree = treeId;
    this._highlightSidebarTab(treeId);
    this._hideTooltip();
    this._renderTree(treeId);
    this._updatePoints();
    this._updateSidebarPoints();
  }

  _afterChange(treeId) {
    this._renderTree(treeId);
    this._updatePoints();
    this._refreshSidebar();
    this._refreshBottomBar();
  }

  _renderTree(treeId) {
    // Clean up previous
    this._dyn.forEach(o => o.destroy());
    this._dyn = [];
    this._pulseTweens.forEach(t => t.stop());
    this._pulseTweens = [];

    const tree = CLASS_TREES[treeId];
    if (!tree) return;
    const visible = isTreeVisible(treeId);

    const W = this.scale.width;
    const H = this.scale.height;
    const mainX = this._mainX + 20;
    const mainW = W - mainX - 30;
    const mainCX = mainX + mainW / 2;
    const colW = mainW / 3;

    const treeColor = Phaser.Display.Color.HexStringToColor(tree.color).color;
    const gfx = this.add.graphics().setDepth(1);
    this._dyn.push(gfx);

    // ── Tree name ──
    const treeName = this.add.text(mainCX, 36, tree.name, {
      fontSize: '22px', fontFamily: TUI.FONT_TITLE, color: tree.color,
    }).setOrigin(0.5, 0).setDepth(3);
    this._dyn.push(treeName);

    // ── Locked overlay ──
    if (!visible) {
      let lockMsg = 'LOCKED';
      if (tree.hidden) lockMsg = 'SECRET \u2014 ???';
      else if (tree.requiresTree) {
        const pName = CLASS_TREES[tree.requiresTree] ? CLASS_TREES[tree.requiresTree].name : '';
        lockMsg = 'Requires ' + pName + ' mastery';
      }
      const lockText = this.add.text(mainCX, 62, lockMsg, {
        fontSize: '13px', fontFamily: TUI.FONT_TITLE, color: '#cc5555',
      }).setOrigin(0.5).setDepth(3);
      this._dyn.push(lockText);
    }

    // ── Description ──
    const descY = visible ? 62 : 80;
    const desc = this.add.text(mainCX, descY, tree.desc, {
      fontSize: '14px', fontFamily: TUI.FONT_BODY, color: '#aabbcc',
      wordWrap: { width: mainW - 40 },
    }).setOrigin(0.5, 0).setDepth(2);
    this._dyn.push(desc);

    // ── Skill Points Bar (below description) ──
    const barY = descY + 30;
    const barW = 280;
    this._spBarBg = this.add.rectangle(mainCX, barY, barW, 14, 0x111122, 0.7)
      .setStrokeStyle(1, TUI.GOLD, 0.3).setDepth(2);
    this._dyn.push(this._spBarBg);
    this._spBarFill = this.add.rectangle(mainCX - barW/2 + 1, barY, 0, 12, 0x44aa44, 0.6)
      .setOrigin(0, 0.5).setDepth(2);
    this._dyn.push(this._spBarFill);
    this._spBarMaxW = barW - 2;
    this._pointsText = this.add.text(mainCX, barY, '', {
      fontSize: '10px', fontFamily: TUI.FONT_BODY, fontStyle: 'bold', color: '#88ffaa',
    }).setOrigin(0.5).setDepth(3);
    this._dyn.push(this._pointsText);
    this._updatePoints();

    // ── Layout positions ──
    const nodeW = 140;
    const nodeH = 70;
    const appW = mainW - 40;
    const appH = 60;

    // Vertical positions (top to bottom: master → tier3 → tier2 → tier1 → tier0 → apprentice)
    const masterY = barY + 36;
    const tier3Y = masterY + 80;
    const tier2Y = tier3Y + 80;
    const tier1Y = tier2Y + 80;
    const tier0Y = tier1Y + 80;
    const apprenticeY = tier0Y + 80;
    const tierYMap = { 3: tier3Y, 2: tier2Y, 1: tier1Y, 0: tier0Y };

    // ── Branch headers ──
    for (let b = 0; b < tree.branches.length; b++) {
      const cx = mainX + colW * b + colW / 2;
      const hdr = this.add.text(cx, masterY - 12, tree.branches[b], {
        fontSize: '14px', fontFamily: TUI.FONT_TITLE, color: tree.color,
      }).setOrigin(0.5).setDepth(2).setAlpha(0.8);
      this._dyn.push(hdr);
    }

    // ── APPRENTICE NODE (bottom, full-width card) ──
    const appInfo = getApprenticeInfo(treeId);
    const appRank = getTalentRank(treeId, '_app');
    const appMaxed = appRank >= 1;
    const appCanAlloc = canAllocateTalent(treeId, '_app');
    this._renderWideNode(mainCX, apprenticeY, appW, appH, appInfo, treeId, '_app',
      appMaxed, appCanAlloc, treeColor, tree.color, visible, false);

    // ── MASTER NODE (top, full-width card, ornate) ──
    const masInfo = getMasterInfo(treeId);
    const masRank = getTalentRank(treeId, '_mas');
    const masMaxed = masRank >= 1;
    const masCanAlloc = canAllocateTalent(treeId, '_mas');
    this._renderWideNode(mainCX, masterY + 20, appW, appH, masInfo, treeId, '_mas',
      masMaxed, masCanAlloc, treeColor, tree.color, visible, true);

    // ── Connection lines: Apprentice → all tier 0, all tier 3 → Master ──
    for (let b = 0; b < 3; b++) {
      const cx = mainX + colW * b + colW / 2;
      // Apprentice to tier 0
      const appLine = appMaxed ? treeColor : 0x333344;
      gfx.lineStyle(1, appLine, appMaxed ? 0.6 : 0.2);
      gfx.beginPath(); gfx.moveTo(mainCX, apprenticeY - appH/2); gfx.lineTo(cx, tier0Y + nodeH/2); gfx.strokePath();
      // Tier 3 to master
      const t3talents = tree.talents.filter(t => t.branch === b && t.tier === 3);
      const t3Maxed = t3talents.every(t => getTalentRank(treeId, t.id) >= t.maxRank);
      const masLine = t3Maxed ? treeColor : 0x333344;
      gfx.lineStyle(1, masLine, t3Maxed ? 0.6 : 0.2);
      gfx.beginPath(); gfx.moveTo(cx, tier3Y - nodeH/2); gfx.lineTo(mainCX, masterY + 20 + appH/2); gfx.strokePath();
    }

    // ── Node positions map ──
    const nodePositions = {};
    for (const talent of tree.talents) {
      const cx = mainX + colW * talent.branch + colW / 2;
      const cy = tierYMap[talent.tier];
      nodePositions[talent.id] = { cx, cy };
    }

    // ── Branch connection lines (tier-to-tier) ──
    for (const talent of tree.talents) {
      if (talent.prereq && nodePositions[talent.prereq]) {
        const parent = nodePositions[talent.prereq];
        const child = nodePositions[talent.id];
        const prereqMaxed = getTalentRank(treeId, talent.prereq) >= _findTalent(treeId, talent.prereq).maxRank;
        gfx.lineStyle(1, prereqMaxed ? treeColor : 0x333344, prereqMaxed ? 0.6 : 0.2);
        gfx.beginPath(); gfx.moveTo(parent.cx, parent.cy - nodeH/2); gfx.lineTo(child.cx, child.cy + nodeH/2); gfx.strokePath();
      }
    }

    // ── Render talent nodes ──
    for (const talent of tree.talents) {
      const pos = nodePositions[talent.id];
      this._renderTalentNode(pos.cx, pos.cy, nodeW, nodeH, talent, treeId, treeColor, tree.color, visible);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  WIDE NODE — Apprentice / Master
  // ══════════════════════════════════════════════════════════

  _renderWideNode(cx, cy, w, h, info, treeId, talentId, isMaxed, canAlloc, treeColor, treeColorStr, visible, isMasterNode) {
    const cost = talentId === '_app' ? APPRENTICE_COST : MASTER_COST;
    const isLocked = !canAlloc && !isMaxed;

    // Background
    let bgColor, strokeColor, strokeAlpha;
    if (isMaxed) {
      bgColor = TUI.PARCHMENT; strokeColor = isMasterNode ? TUI.GOLD : treeColor; strokeAlpha = 1;
    } else if (canAlloc) {
      bgColor = TUI.SURFACE; strokeColor = TUI.GOLD; strokeAlpha = 0.8;
    } else {
      bgColor = TUI.SURFACE; strokeColor = 0x333355; strokeAlpha = 0.4;
    }

    const bg = this.add.rectangle(cx, cy, w, h, bgColor, isLocked ? 0.4 : 0.9)
      .setStrokeStyle(isMasterNode && isMaxed ? 2 : 1, strokeColor, strokeAlpha)
      .setDepth(2).setInteractive({ useHandCursor: visible });
    this._dyn.push(bg);

    // Ornate double border for master
    if (isMasterNode) {
      const ornate = this.add.rectangle(cx, cy, w - 6, h - 6, 0x000000, 0)
        .setStrokeStyle(1, isMaxed ? TUI.GOLD : 0x333355, isMaxed ? 0.4 : 0.15).setDepth(2);
      this._dyn.push(ornate);
    }

    // Checkmark for learned
    if (isMaxed) {
      const check = this.add.text(cx - w/2 + 14, cy - 6, '\u2713', {
        fontSize: '16px', fontFamily: TUI.FONT_BODY, color: isMasterNode ? TUI.GOLD_S : '#88ff88',
      }).setDepth(3);
      this._dyn.push(check);
    }

    // Name
    const nameX = isMaxed ? cx - w/2 + 34 : cx - w/2 + 14;
    const name = this.add.text(nameX, cy - 14, info.name, {
      fontSize: '16px', fontFamily: TUI.FONT_TITLE,
      color: isLocked ? TUI.DIM : (isMasterNode && isMaxed ? TUI.GOLD_S : TUI.TEXT),
    }).setDepth(3);
    this._dyn.push(name);

    // Description (truncated for card)
    const descText = (info.desc || '').length > 60 ? info.desc.substring(0, 57) + '...' : (info.desc || '');
    const descLabel = this.add.text(nameX, cy + 4, descText, {
      fontSize: '12px', fontFamily: TUI.FONT_BODY, color: isLocked ? '#444460' : '#8899aa',
      wordWrap: { width: w - 100 },
    }).setDepth(3);
    this._dyn.push(descLabel);

    // Cost pill — show XP type
    if (!isMaxed) {
      const xpType = typeof getTreeXPType === 'function' ? getTreeXPType(treeId) : 'combat';
      const xpInfo = (typeof XP_TYPE_INFO !== 'undefined' && XP_TYPE_INFO[xpType]) || { icon: '⚔', name: 'XP', color: '#e94560' };
      const xpCost = cost * (typeof XP_PER_TALENT_POINT !== 'undefined' ? XP_PER_TALENT_POINT : 100);
      const pillText = xpInfo.icon + ' ' + xpCost;
      const pill = this.add.text(cx + w/2 - 14, cy, pillText, {
        fontSize: '11px', fontFamily: TUI.FONT_BODY, fontStyle: 'bold',
        color: canAlloc ? xpInfo.color : TUI.DIM,
        backgroundColor: canAlloc ? '#1a1a30' : '#0e0e1e',
        padding: { x: 6, y: 3 },
      }).setOrigin(1, 0.5).setDepth(3);
      this._dyn.push(pill);
    }

    // Pulse tween for available
    if (canAlloc && !isMaxed) {
      const tw = this.tweens.add({
        targets: bg, alpha: { from: 0.9, to: 0.65 },
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this._pulseTweens.push(tw);
    }

    this._addNodeInteraction(bg, treeId, talentId, info, isMaxed, canAlloc, strokeColor, visible);
  }

  // ══════════════════════════════════════════════════════════
  //  TALENT NODE — Branch cards
  // ══════════════════════════════════════════════════════════

  _renderTalentNode(cx, cy, w, h, talent, treeId, treeColor, treeColorStr, visible) {
    const rank = getTalentRank(treeId, talent.id);
    const canAlloc = canAllocateTalent(treeId, talent.id);
    const isMaxed = rank >= talent.maxRank;
    const isLocked = !canAlloc && rank === 0;

    let bgColor, bgAlpha, strokeColor, strokeAlpha;
    if (isMaxed) {
      bgColor = treeColor; bgAlpha = 0.2; strokeColor = treeColor; strokeAlpha = 0.8;
    } else if (rank > 0) {
      bgColor = TUI.SURFACE; bgAlpha = 0.9; strokeColor = treeColor; strokeAlpha = 0.6;
    } else if (canAlloc) {
      bgColor = TUI.SURFACE; bgAlpha = 0.9; strokeColor = TUI.GOLD; strokeAlpha = 0.7;
    } else {
      bgColor = TUI.SURFACE; bgAlpha = 0.4; strokeColor = 0x333355; strokeAlpha = 0.3;
    }

    // Rounded-corner card via graphics
    const cardGfx = this.add.graphics().setDepth(2);
    const r = 6; // corner radius
    cardGfx.fillStyle(bgColor, bgAlpha);
    cardGfx.fillRoundedRect(cx - w/2, cy - h/2, w, h, r);
    cardGfx.lineStyle(isMaxed ? 2 : 1, strokeColor, strokeAlpha);
    cardGfx.strokeRoundedRect(cx - w/2, cy - h/2, w, h, r);
    this._dyn.push(cardGfx);

    // Invisible hit area for interaction
    const hitArea = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setDepth(3).setInteractive({ useHandCursor: !isLocked || !visible });
    this._dyn.push(hitArea);

    // Checkmark
    if (isMaxed) {
      const check = this.add.text(cx + w/2 - 16, cy - h/2 + 4, '\u2713', {
        fontSize: '13px', fontFamily: TUI.FONT_BODY, fontStyle: 'bold', color: '#88ff88',
      }).setDepth(4);
      this._dyn.push(check);
    }

    // Name
    const name = this.add.text(cx, cy - 14, talent.name, {
      fontSize: '14px', fontFamily: TUI.FONT_BODY, fontStyle: 'bold',
      color: isLocked ? TUI.DIM : TUI.TEXT,
    }).setOrigin(0.5, 0.5).setDepth(4);
    this._dyn.push(name);

    // Description (abbreviated)
    const descText = (talent.desc || '').length > 45 ? talent.desc.substring(0, 42) + '...' : (talent.desc || '');
    const descLabel = this.add.text(cx, cy + 4, descText, {
      fontSize: '11px', fontFamily: TUI.FONT_BODY,
      color: isLocked ? '#444460' : '#8899aa',
      wordWrap: { width: w - 16 },
    }).setOrigin(0.5, 0).setDepth(4);
    this._dyn.push(descLabel);

    // Cost pill (bottom-right) — XP type
    if (!isMaxed) {
      const _xpT = typeof getTreeXPType === 'function' ? getTreeXPType(treeId) : 'combat';
      const _xpI = (typeof XP_TYPE_INFO !== 'undefined' && XP_TYPE_INFO[_xpT]) || { icon: '⚔', color: '#e94560' };
      const _xpC = talent.cost * (typeof XP_PER_TALENT_POINT !== 'undefined' ? XP_PER_TALENT_POINT : 100);
      const pill = this.add.text(cx + w/2 - 8, cy + h/2 - 6, _xpI.icon + _xpC, {
        fontSize: '10px', fontFamily: TUI.FONT_BODY,
        color: canAlloc ? _xpI.color : TUI.DIM,
        backgroundColor: '#0e0e1e',
        padding: { x: 4, y: 2 },
      }).setOrigin(1, 1).setDepth(4);
      this._dyn.push(pill);
    }

    // Pulse tween for available nodes
    if (canAlloc && !isMaxed) {
      const tw = this.tweens.add({
        targets: hitArea, alpha: { from: 0, to: 0.08 },
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this._pulseTweens.push(tw);
      // Also pulse the card border
      const tw2 = this.tweens.add({
        targets: cardGfx, alpha: { from: 1, to: 0.7 },
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this._pulseTweens.push(tw2);
    }

    this._addNodeInteraction(hitArea, treeId, talent.id, talent, isMaxed, canAlloc, strokeColor, visible);
  }

  // ══════════════════════════════════════════════════════════
  //  SHARED NODE INTERACTION
  // ══════════════════════════════════════════════════════════

  _addNodeInteraction(bg, treeId, talentId, talentInfo, isMaxed, canAlloc, strokeColor, visible) {
    bg.on('pointerover', (pointer) => {
      this._showTooltip(treeId, talentId, talentInfo, pointer);
    });
    bg.on('pointermove', (pointer) => {
      this._moveTooltip(pointer);
    });
    bg.on('pointerout', () => {
      this._hideTooltip();
    });
    bg.on('pointerdown', (pointer) => {
      if (!visible) return;
      if (pointer.event.shiftKey || pointer.rightButtonDown()) {
        if (deallocateTalent(treeId, talentId)) {
          if (typeof GameAudio !== 'undefined') GameAudio.menuOpen();
          this._afterChange(treeId);
        }
      } else {
        if (allocateTalent(treeId, talentId)) {
          if (typeof GameAudio !== 'undefined') GameAudio.collect();
          this._afterChange(treeId);
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  //  FLOATING TOOLTIP
  // ══════════════════════════════════════════════════════════

  _showTooltip(treeId, talentId, talentInfo, pointer) {
    this._hideTooltip();

    const rank = getTalentRank(treeId, talentId);
    const maxRank = talentInfo.maxRank || 1;
    const cost = talentInfo.cost || (talentId === '_app' ? APPRENTICE_COST : (talentId === '_mas' ? MASTER_COST : 1));
    const isLearned = rank >= maxRank;
    const canAlloc = canAllocateTalent(treeId, talentId);
    const canDealloc = canDeallocateTalent(treeId, talentId);

    const ttW = 280;
    const container = this.add.container(0, 0).setDepth(10);

    // Build text elements first to measure height
    const pad = 12;
    let yOff = pad;

    const nameText = this.add.text(pad, yOff, talentInfo.name, {
      fontSize: '16px', fontFamily: TUI.FONT_TITLE, color: TUI.GOLD_S,
    });
    yOff += 24;

    const descText = this.add.text(pad, yOff, talentInfo.desc || '', {
      fontSize: '14px', fontFamily: TUI.FONT_BODY, color: TUI.TEXT,
      wordWrap: { width: ttW - pad * 2 }, lineSpacing: 2,
    });
    yOff += descText.height + 10;

    // Separator
    const sepGfx = this.add.graphics();
    sepGfx.lineStyle(1, TUI.GOLD, 0.2);
    sepGfx.beginPath(); sepGfx.moveTo(pad, yOff); sepGfx.lineTo(ttW - pad, yOff); sepGfx.strokePath();
    yOff += 8;

    const _ttXpT = typeof getTreeXPType === 'function' ? getTreeXPType(treeId) : 'combat';
    const _ttXpI = (typeof XP_TYPE_INFO !== 'undefined' && XP_TYPE_INFO[_ttXpT]) || { icon: '⚔', name: 'XP', color: '#e94560' };
    const _ttXpC = cost * (typeof XP_PER_TALENT_POINT !== 'undefined' ? XP_PER_TALENT_POINT : 100);
    const costText = this.add.text(pad, yOff, `Costs ${_ttXpC} ${_ttXpI.icon} ${_ttXpI.name} XP`, {
      fontSize: '12px', fontFamily: TUI.FONT_BODY, color: TUI.DIM,
    });
    yOff += 18;

    // Status line
    let statusStr, statusColor;
    if (isLearned) {
      statusStr = 'LEARNED \u2713';
      statusColor = '#88ff88';
    } else if (canAlloc) {
      statusStr = 'Click to purchase';
      statusColor = TUI.GOLD_S;
    } else {
      // Figure out why locked
      if (talentId === '_mas') {
        statusStr = 'Requires all branch talents learned';
      } else if (talentId === '_app') {
        const tree = CLASS_TREES[treeId];
        if (tree && tree.requiresTree) {
          const pName = CLASS_TREES[tree.requiresTree] ? CLASS_TREES[tree.requiresTree].name : '';
          statusStr = 'Requires Master ' + pName;
        } else if (tree && tree.hidden) {
          statusStr = 'Secret \u2014 unlock condition hidden';
        } else {
          statusStr = 'Not enough ' + _ttXpI.name + ' XP';
        }
      } else if (talentInfo.prereq) {
        const pt = _findTalent(treeId, talentInfo.prereq);
        statusStr = 'Requires: ' + (pt ? pt.name : talentInfo.prereq);
      } else {
        statusStr = 'Learn Apprentice first';
      }
      statusColor = '#cc6666';
    }

    const statusText = this.add.text(pad, yOff, statusStr, {
      fontSize: '12px', fontFamily: TUI.FONT_BODY, fontStyle: 'bold', color: statusColor,
    });
    yOff += 18;

    // Shift+click hint
    let hintText = null;
    if (isLearned && canDealloc) {
      hintText = this.add.text(pad, yOff, 'Shift+Click to unlearn', {
        fontSize: '11px', fontFamily: TUI.FONT_BODY, fontStyle: 'italic', color: '#cc6666',
      });
      yOff += 16;
    } else if (isLearned && !canDealloc) {
      hintText = this.add.text(pad, yOff, 'Cannot unlearn (dependents learned)', {
        fontSize: '11px', fontFamily: TUI.FONT_BODY, fontStyle: 'italic', color: '#555577',
      });
      yOff += 16;
    }

    const ttH = yOff + pad;

    // Background
    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(Phaser.Display.Color.GetColor(22, 28, 46), 0.95);
    bgGfx.fillRoundedRect(0, 0, ttW, ttH, 4);
    bgGfx.lineStyle(1, TUI.GOLD, 0.5);
    bgGfx.strokeRoundedRect(0, 0, ttW, ttH, 4);

    container.add([bgGfx, nameText, descText, sepGfx, costText, statusText]);
    if (hintText) container.add(hintText);

    this._tooltip = container;
    this._tooltipW = ttW;
    this._tooltipH = ttH;
    this._moveTooltip(pointer);
  }

  _moveTooltip(pointer) {
    if (!this._tooltip) return;
    const W = this.scale.width;
    const H = this.scale.height;
    let x = pointer.x + 16;
    let y = pointer.y - 10;
    // Clamp to screen
    if (x + this._tooltipW > W - 10) x = pointer.x - this._tooltipW - 16;
    if (y + this._tooltipH > H - 10) y = H - this._tooltipH - 10;
    if (y < 10) y = 10;
    this._tooltip.setPosition(x, y);
  }

  _hideTooltip() {
    if (this._tooltip) {
      this._tooltip.destroy();
      this._tooltip = null;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  POINTS DISPLAY
  // ══════════════════════════════════════════════════════════

  _updatePoints() {
    if (!this._pointsText) return;
    const remaining = getTalentPointsRemaining();
    const total = getTalentPointsTotal();
    // Show XP for the selected tree's type
    const _barXpT = this._selectedTree && typeof getTreeXPType === 'function' ? getTreeXPType(this._selectedTree) : null;
    const _barXpI = _barXpT && typeof XP_TYPE_INFO !== 'undefined' ? XP_TYPE_INFO[_barXpT] : null;
    if (_barXpI && typeof getAvailableXP === 'function') {
      const avail = getAvailableXP(_barXpT);
      const earned = (G.professionXP && G.professionXP[_barXpT]) || 0;
      this._pointsText.setText(_barXpI.icon + ' ' + _barXpI.name + ' XP: ' + avail + ' available (' + earned + ' earned)');
    } else {
      this._pointsText.setText('Skill Points: ' + remaining + ' / ' + total);
    }
    this._pointsText.setColor(remaining > 0 ? '#88ffaa' : '#ff8888');
    // Update bar fill
    if (this._spBarFill && this._spBarMaxW) {
      const pct = total > 0 ? remaining / total : 0;
      this._spBarFill.setSize(Math.max(1, pct * this._spBarMaxW), 12);
      this._spBarFill.setFillStyle(remaining > 20 ? 0x44aa44 : (remaining > 5 ? 0xaaaa44 : 0xaa4444));
    }
  }

  // ══════════════════════════════════════════════════════════
  //  RESPEC
  // ══════════════════════════════════════════════════════════

  _respecCurrent() {
    if (!this._selectedTree) return;
    if (getTreePointsSpent(this._selectedTree) === 0) return;
    respecTree(this._selectedTree);
    if (typeof GameAudio !== 'undefined') GameAudio.hurt();
    this._afterChange(this._selectedTree);
  }

  // ══════════════════════════════════════════════════════════
  //  CLOSE
  // ══════════════════════════════════════════════════════════

  _close() {
    // Clean up intro overlay if still showing
    const introOverlay = document.getElementById('talent-intro-overlay');
    if (introOverlay) introOverlay.remove();

    if (typeof GameAudio !== 'undefined') GameAudio.menuOpen();
    this._hideTooltip();
    this.scene.stop();
    this.scene.resume('WorldScene');
  }
}
