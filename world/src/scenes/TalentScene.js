// ══════════════════════════════════════════════════════════
//  TALENT SCENE — WoW-style talent calculator
//  Bottom-to-top: Apprentice → Tier 0-3 → Master
//  All trees viewable (locked ones are read-only)
// ══════════════════════════════════════════════════════════

class TalentScene extends Phaser.Scene {
  constructor() { super('TalentScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this._dyn = [];
    this._sideDyn = [];
    this._selectedTree = null;

    this.input.mouse.disableContextMenu();

    // Full-screen backdrop
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.9).setDepth(0);

    // Title bar
    this.add.rectangle(W / 2, 20, W, 40, 0x0a0a1a, 0.95).setDepth(1);
    this.add.text(16, 12, 'TALENT CALCULATOR', {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
    }).setDepth(2);

    // Close button
    const closeBtn = this.add.rectangle(W - 24, 20, 36, 28, 0x442222)
      .setStrokeStyle(1, 0x663333).setDepth(2).setInteractive({ useHandCursor: true });
    this.add.text(W - 24, 20, 'X', {
      fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff6666',
    }).setOrigin(0.5).setDepth(3);
    closeBtn.on('pointerdown', () => this._close());
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x663333));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x442222));

    // SWG-style Skill Points bar (top center)
    const barW = 300;
    const barX = this._sideW + (W - this._sideW) / 2;
    this._spBarBg = this.add.rectangle(barX, 20, barW, 16, 0x111122, 0.9)
      .setStrokeStyle(1, 0x333355).setDepth(2);
    this._spBarFill = this.add.rectangle(barX - barW/2, 20, 0, 14, 0x44aa44, 0.7)
      .setOrigin(0, 0.5).setDepth(2);
    this._pointsText = this.add.text(barX, 20, '', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ffaa',
    }).setOrigin(0.5).setDepth(3);
    this._spBarMaxW = barW - 2;

    // ESC to close
    this.input.keyboard.on('keydown-ESC', () => this._close());

    // Sidebar background
    this._sideW = 200;
    this.add.rectangle(this._sideW / 2, H / 2 + 20, this._sideW, H - 40, 0x111122, 0.95)
      .setStrokeStyle(1, 0x222244).setDepth(1);

    // Respec button
    const respecY = H - 50;
    const respecBg = this.add.rectangle(this._sideW / 2, respecY, this._sideW - 12, 32, 0x442222, 0.9)
      .setStrokeStyle(1, 0x663333).setDepth(2).setInteractive({ useHandCursor: true });
    this.add.text(this._sideW / 2, respecY, 'SURRENDER ALL', {
      fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff8888',
    }).setOrigin(0.5).setDepth(3);
    respecBg.on('pointerdown', () => this._respecCurrent());
    respecBg.on('pointerover', () => respecBg.setFillStyle(0x553333));
    respecBg.on('pointerout', () => respecBg.setFillStyle(0x442222));

    // Tooltip area
    this._tooltipName = this.add.text(this._sideW + 20, H - 80, '', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
    }).setDepth(3);
    this._tooltipDesc = this.add.text(this._sideW + 20, H - 60, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc',
      wordWrap: { width: W - this._sideW - 40 },
    }).setDepth(3);
    this._tooltipRank = this.add.text(W - 60, H - 80, '', {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ff88',
    }).setOrigin(1, 0).setDepth(3);
    this._tooltipHint = this.add.text(this._sideW + 20, H - 40, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#555577',
    }).setDepth(3);

    // Build sidebar + select first tree
    this._buildSidebar();
    const firstTree = Object.keys(CLASS_TREES)[0];
    if (firstTree) this._selectTree(firstTree);
    this._updatePoints();
  }

  // ── Sidebar (all trees clickable for viewing) ────────

  _buildSidebar() {
    this._sideDyn.forEach(o => o.destroy());
    this._sideDyn = [];
    this._sidebarTabs = [];

    const treeIds = Object.keys(CLASS_TREES);
    const tabH = 30;
    const gap = 2;
    let y = 50;

    for (const treeId of treeIds) {
      const tree = CLASS_TREES[treeId];
      const visible = isTreeVisible(treeId);
      const isSubTree = !!tree.requiresTree;
      const isHidden = !!tree.hidden;
      const indent = isSubTree ? 16 : 0;

      // Hide sub-trees of hidden parents until the parent is unlocked
      // (e.g. Shadow Knight stays hidden until Dark Rider is unlocked)
      if (isSubTree && isHidden) {
        const parentTree = CLASS_TREES[tree.requiresTree];
        const parentUnlocked = parentTree && !parentTree.hidden ? true :
          (parentTree && parentTree.hidden === 'darkRider' && G.darkRiderUnlocked) ||
          (parentTree && parentTree.hidden === 'elder' && G.elderUnlocked);
        if (!parentUnlocked) continue; // skip entirely
      }

      let displayName, displayColor;
      if (isHidden && !visible && !isSubTree) {
        // Only base hidden trees show as ???
        displayName = '???';
        displayColor = '#555555';
      } else if (isSubTree && !visible) {
        displayName = tree.name;
        displayColor = '#444455';
      } else {
        displayName = tree.name;
        displayColor = tree.color;
      }

      const bg = this.add.rectangle(this._sideW / 2, y, this._sideW - 8, tabH, 0x1a1a2e, 0.8)
        .setStrokeStyle(1, 0x333355).setDepth(2)
        .setInteractive({ useHandCursor: true });
      this._sideDyn.push(bg);

      // ALL trees clickable for viewing
      bg.on('pointerdown', () => this._selectTree(treeId));
      bg.on('pointerover', () => { if (this._selectedTree !== treeId) bg.setFillStyle(0x222244); });
      bg.on('pointerout', () => { if (this._selectedTree !== treeId) bg.setFillStyle(0x1a1a2e); });

      if (isSubTree) {
        const conn = this.add.text(6, y - 5, '└', {
          fontSize: '9px', fontFamily: 'monospace', color: '#333355',
        }).setDepth(3);
        this._sideDyn.push(conn);
      }

      const label = this.add.text(10 + indent, y - 5, displayName, {
        fontSize: isSubTree ? '10px' : '11px',
        fontFamily: 'Georgia, serif', fontStyle: 'bold', color: displayColor,
      }).setDepth(3);
      this._sideDyn.push(label);

      const pts = this.add.text(this._sideW - 10, y + 3, '', {
        fontSize: '8px', fontFamily: 'monospace', color: '#666688',
      }).setOrigin(1, 0).setDepth(3);
      this._sideDyn.push(pts);

      this._sidebarTabs.push({ treeId, bg, label, pts, visible });
      y += tabH + gap;
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
        tab.pts.setColor(mastered ? '#88ff88' : '#666688');
      } else {
        tab.pts.setText('');
      }
    }
  }

  _highlightSidebarTab(treeId) {
    for (const tab of this._sidebarTabs) {
      if (tab.treeId === treeId) {
        const c = CLASS_TREES[treeId] ? Phaser.Display.Color.HexStringToColor(CLASS_TREES[treeId].color).color : 0x4488aa;
        tab.bg.setFillStyle(0x333366);
        tab.bg.setStrokeStyle(2, c);
      } else {
        tab.bg.setFillStyle(0x1a1a2e);
        tab.bg.setStrokeStyle(1, 0x333355);
      }
    }
  }

  // ── Tree Selection & Rendering ───────────────────────

  _selectTree(treeId) {
    this._selectedTree = treeId;
    this._highlightSidebarTab(treeId);
    this._clearTooltip();
    this._renderTree(treeId);
    this._updatePoints();
    this._updateSidebarPoints();
  }

  _afterChange(treeId) {
    this._renderTree(treeId);
    this._updatePoints();
    this._refreshSidebar();
  }

  _renderTree(treeId) {
    this._dyn.forEach(o => o.destroy());
    this._dyn = [];

    const tree = CLASS_TREES[treeId];
    if (!tree) return;
    const visible = isTreeVisible(treeId);

    const W = this.scale.width;
    const H = this.scale.height;
    const mainX = this._sideW + 10;
    const mainW = W - mainX - 10;
    const mainCX = mainX + mainW / 2;
    const colW = mainW / 3;

    // Locked overlay label
    if (!visible) {
      let lockMsg = 'LOCKED';
      if (tree.hidden) lockMsg = 'SECRET — ???';
      else if (tree.requiresTree) {
        const pName = CLASS_TREES[tree.requiresTree] ? CLASS_TREES[tree.requiresTree].name : '';
        lockMsg = 'Requires ' + pName + ' mastery';
      }
      const lockText = this.add.text(mainCX, 50, lockMsg, {
        fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff6666',
      }).setOrigin(0.5).setDepth(3);
      this._dyn.push(lockText);
    }

    // Description
    const desc = this.add.text(mainCX, 62, tree.desc, {
      fontSize: '10px', fontFamily: 'Georgia, serif', color: '#777788',
      wordWrap: { width: mainW - 20 },
    }).setOrigin(0.5, 0).setDepth(2);
    this._dyn.push(desc);

    // Layout: bottom-to-top
    // Row positions (y): Master(top) → Tier3 → Tier2 → Tier1 → Tier0 → Apprentice(bottom)
    const nodeW = 125;
    const nodeH = 50;
    const masterY = 90;
    const tier3Y = 150;
    const tier2Y = 210;
    const tier1Y = 270;
    const tier0Y = 330;
    const apprenticeY = 400;
    const tierYMap = { 3: tier3Y, 2: tier2Y, 1: tier1Y, 0: tier0Y };

    // Branch headers (between master and tier 3)
    for (let b = 0; b < tree.branches.length; b++) {
      const cx = mainX + colW * b + colW / 2;
      const hdr = this.add.text(cx, 80, tree.branches[b], {
        fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: tree.color,
      }).setOrigin(0.5).setDepth(2);
      this._dyn.push(hdr);
    }

    const treeColor = Phaser.Display.Color.HexStringToColor(tree.color).color;
    const gfx = this.add.graphics().setDepth(1);
    this._dyn.push(gfx);

    // ── Render APPRENTICE node (bottom, centered, wide) ──
    const appInfo = getApprenticeInfo(treeId);
    const appRank = getTalentRank(treeId, '_app');
    const appMaxed = appRank >= 1;
    const appCanAlloc = canAllocateTalent(treeId, '_app');
    const appW = mainW - 40;
    let appBgColor, appStroke;
    if (appMaxed) { appBgColor = treeColor; appStroke = treeColor; }
    else if (appCanAlloc) { appBgColor = 0x222244; appStroke = 0x4488aa; }
    else { appBgColor = 0x151520; appStroke = 0x222233; }

    const appBg = this.add.rectangle(mainCX, apprenticeY, appW, nodeH, appBgColor, appMaxed ? 0.25 : 0.9)
      .setStrokeStyle(appMaxed ? 2 : 1, appStroke).setDepth(2)
      .setInteractive({ useHandCursor: visible });
    this._dyn.push(appBg);
    const appName = this.add.text(mainCX, apprenticeY - 10, appInfo.name, {
      fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: appMaxed ? '#ccccdd' : (appCanAlloc ? '#ccccdd' : '#555566'),
    }).setOrigin(0.5).setDepth(3);
    this._dyn.push(appName);
    const appRankTxt = this.add.text(mainCX, apprenticeY + 10, appMaxed ? '✓ LEARNED' : (appCanAlloc ? 'Purchase (' + APPRENTICE_COST + ' pts)' : 'LOCKED'), {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: appMaxed ? '#88ff88' : (appCanAlloc ? '#44bbff' : '#555566'),
    }).setOrigin(0.5).setDepth(3);
    this._dyn.push(appRankTxt);
    if (!appMaxed && appCanAlloc) {
      const costTxt = this.add.text(mainCX + appW/2 - 4, apprenticeY - nodeH/2 + 4, APPRENTICE_COST + 'pt', {
        fontSize: '8px', fontFamily: 'monospace', color: '#888899',
      }).setOrigin(1, 0).setDepth(3);
      this._dyn.push(costTxt);
    }
    this._addNodeInteraction(appBg, treeId, '_app', appInfo, appMaxed, appCanAlloc, appStroke, visible);

    // ── Render MASTER node (top, centered, wide) ──
    const masInfo = getMasterInfo(treeId);
    const masRank = getTalentRank(treeId, '_mas');
    const masMaxed = masRank >= 1;
    const masCanAlloc = canAllocateTalent(treeId, '_mas');
    let masBgColor, masStroke;
    if (masMaxed) { masBgColor = treeColor; masStroke = treeColor; }
    else if (masCanAlloc) { masBgColor = 0x222244; masStroke = 0x4488aa; }
    else { masBgColor = 0x151520; masStroke = 0x222233; }

    const masBg = this.add.rectangle(mainCX, masterY, appW, nodeH, masBgColor, masMaxed ? 0.25 : 0.9)
      .setStrokeStyle(masMaxed ? 2 : 1, masStroke).setDepth(2)
      .setInteractive({ useHandCursor: visible });
    this._dyn.push(masBg);
    const masName = this.add.text(mainCX, masterY - 10, masInfo.name, {
      fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: masMaxed ? '#ffdd44' : (masCanAlloc ? '#ccccdd' : '#555566'),
    }).setOrigin(0.5).setDepth(3);
    this._dyn.push(masName);
    const masRankTxt = this.add.text(mainCX, masterY + 10, masMaxed ? '✓ MASTERED' : (masCanAlloc ? 'Purchase (' + MASTER_COST + ' pts)' : 'LOCKED'), {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: masMaxed ? '#ffdd44' : (masCanAlloc ? '#44bbff' : '#555566'),
    }).setOrigin(0.5).setDepth(3);
    this._dyn.push(masRankTxt);
    if (!masMaxed && masCanAlloc) {
      const costTxt = this.add.text(mainCX + appW/2 - 4, masterY - nodeH/2 + 4, MASTER_COST + 'pt', {
        fontSize: '8px', fontFamily: 'monospace', color: '#888899',
      }).setOrigin(1, 0).setDepth(3);
      this._dyn.push(costTxt);
    }
    this._addNodeInteraction(masBg, treeId, '_mas', masInfo, masMaxed, masCanAlloc, masStroke, visible);

    // ── Connection lines: Apprentice → all tier 0, all tier 3 → Master ──
    for (let b = 0; b < 3; b++) {
      const cx = mainX + colW * b + colW / 2;
      // Apprentice to tier 0
      const appLine = appMaxed ? treeColor : 0x333344;
      gfx.lineStyle(2, appLine, appMaxed ? 0.7 : 0.3);
      gfx.beginPath(); gfx.moveTo(mainCX, apprenticeY - nodeH/2); gfx.lineTo(cx, tier0Y + nodeH/2); gfx.strokePath();
      // Tier 3 to master
      const t3talents = tree.talents.filter(t => t.branch === b && t.tier === 3);
      const t3Maxed = t3talents.every(t => getTalentRank(treeId, t.id) >= t.maxRank);
      const masLine = t3Maxed ? treeColor : 0x333344;
      gfx.lineStyle(2, masLine, t3Maxed ? 0.7 : 0.3);
      gfx.beginPath(); gfx.moveTo(cx, tier3Y - nodeH/2); gfx.lineTo(mainCX, masterY + nodeH/2); gfx.strokePath();
    }

    // ── Render branch talent nodes ──
    const nodePositions = {};
    for (const talent of tree.talents) {
      const cx = mainX + colW * talent.branch + colW / 2;
      const cy = tierYMap[talent.tier];
      nodePositions[talent.id] = { cx, cy };
    }

    // Branch connection lines (tier-to-tier within branch)
    for (const talent of tree.talents) {
      if (talent.prereq && nodePositions[talent.prereq]) {
        const parent = nodePositions[talent.prereq];
        const child = nodePositions[talent.id];
        const prereqMaxed = getTalentRank(treeId, talent.prereq) >= _findTalent(treeId, talent.prereq).maxRank;
        gfx.lineStyle(2, prereqMaxed ? treeColor : 0x333344, prereqMaxed ? 0.7 : 0.3);
        gfx.beginPath(); gfx.moveTo(parent.cx, parent.cy - nodeH/2); gfx.lineTo(child.cx, child.cy + nodeH/2); gfx.strokePath();
      }
    }

    // Draw talent nodes
    for (const talent of tree.talents) {
      const pos = nodePositions[talent.id];
      const rank = getTalentRank(treeId, talent.id);
      const canAlloc = canAllocateTalent(treeId, talent.id);
      const isMaxed = rank >= talent.maxRank;
      const isLocked = !canAlloc && rank === 0;

      let bgColor, strokeColor, bgAlpha;
      if (isMaxed) { bgColor = treeColor; bgAlpha = 0.25; strokeColor = treeColor; }
      else if (rank > 0) { bgColor = 0x223344; bgAlpha = 0.9; strokeColor = treeColor; }
      else if (canAlloc) { bgColor = 0x222244; bgAlpha = 0.9; strokeColor = 0x4488aa; }
      else { bgColor = 0x151520; bgAlpha = 0.6; strokeColor = 0x222233; }

      const bg = this.add.rectangle(pos.cx, pos.cy, nodeW, nodeH, bgColor, bgAlpha)
        .setStrokeStyle(isMaxed ? 2 : 1, strokeColor).setDepth(2)
        .setInteractive({ useHandCursor: !isLocked || !visible });
      this._dyn.push(bg);

      const nameColor = isLocked ? '#555566' : '#ccccdd';
      const name = this.add.text(pos.cx, pos.cy - 10, talent.name, {
        fontSize: '9px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: nameColor,
      }).setOrigin(0.5).setDepth(3);
      this._dyn.push(name);

      // Status label: LEARNED / Purchase (Xpt) / LOCKED
      let statusLabel, statusColor;
      if (isMaxed) { statusLabel = '✓ LEARNED'; statusColor = '#88ff88'; }
      else if (canAlloc) { statusLabel = 'Purchase (' + talent.cost + ' pts)'; statusColor = '#44bbff'; }
      else { statusLabel = 'LOCKED'; statusColor = '#555566'; }
      const rankText = this.add.text(pos.cx, pos.cy + 10, statusLabel, {
        fontSize: '7px', fontFamily: 'monospace', fontStyle: 'bold', color: statusColor,
      }).setOrigin(0.5).setDepth(3);
      this._dyn.push(rankText);

      this._addNodeInteraction(bg, treeId, talent.id, talent, isMaxed, canAlloc, strokeColor, visible);
    }
  }

  // ── Shared node interaction logic ────────────────────

  _addNodeInteraction(bg, treeId, talentId, talentInfo, isMaxed, canAlloc, strokeColor, visible) {
    bg.on('pointerover', () => {
      if (canAlloc || isMaxed) bg.setStrokeStyle(2, 0xffffff);
      this._showTooltip(treeId, talentId, talentInfo);
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(isMaxed ? 2 : 1, strokeColor);
      this._clearTooltip();
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

  // ── Tooltip ──────────────────────────────────────────

  _showTooltip(treeId, talentId, talentInfo) {
    const rank = getTalentRank(treeId, talentId);
    const maxRank = talentInfo.maxRank || 1;
    const cost = talentInfo.cost || (talentId === '_app' ? APPRENTICE_COST : (talentId === '_mas' ? MASTER_COST : 1));
    const isLearned = rank >= maxRank;
    const canAlloc = canAllocateTalent(treeId, talentId);
    const canDealloc = canDeallocateTalent(treeId, talentId);

    this._tooltipName.setText(talentInfo.name);
    this._tooltipDesc.setText(talentInfo.desc || '');

    if (isLearned) {
      this._tooltipRank.setText('✓ LEARNED');
      this._tooltipRank.setColor('#88ff88');
      this._tooltipHint.setText(canDealloc ? 'Shift+Click to surrender — recover ' + cost + ' skill points' : 'Cannot surrender (dependents learned)');
      this._tooltipHint.setColor(canDealloc ? '#ff8888' : '#555566');
    } else if (canAlloc) {
      this._tooltipRank.setText('Click to purchase — costs ' + cost + ' skill points');
      this._tooltipRank.setColor('#44bbff');
      this._tooltipHint.setText('Skill Points Available: ' + getTalentPointsRemaining());
      this._tooltipHint.setColor('#88ffaa');
    } else {
      this._tooltipRank.setText('LOCKED — ' + cost + ' skill points to learn');
      this._tooltipRank.setColor('#666666');
      if (talentId === '_mas') {
        this._tooltipHint.setText('Requires all branch talents learned');
      } else if (talentId === '_app') {
        const tree = CLASS_TREES[treeId];
        if (tree && tree.requiresTree) {
          const pName = CLASS_TREES[tree.requiresTree] ? CLASS_TREES[tree.requiresTree].name : '';
          this._tooltipHint.setText('Requires Master ' + pName);
        } else if (tree && tree.hidden) {
          this._tooltipHint.setText('Secret — unlock condition hidden');
        } else {
          this._tooltipHint.setText('Not enough skill points');
        }
      } else if (talentInfo.prereq) {
        const pt = _findTalent(treeId, talentInfo.prereq);
        this._tooltipHint.setText('Requires: ' + (pt ? pt.name : talentInfo.prereq));
      } else {
        this._tooltipHint.setText('Learn Apprentice first');
      }
      this._tooltipHint.setColor('#555566');
    }
  }

  _clearTooltip() {
    this._tooltipName.setText('');
    this._tooltipDesc.setText('');
    this._tooltipRank.setText('');
    this._tooltipHint.setText('Hover a talent for details');
  }

  // ── Points Display ───────────────────────────────────

  _updatePoints() {
    const remaining = getTalentPointsRemaining();
    const total = getTalentPointsTotal();
    const spent = getTalentPointsSpent();
    this._pointsText.setText('Skill Points Available: ' + remaining + ' / ' + total);
    this._pointsText.setColor(remaining > 0 ? '#88ffaa' : '#ff8888');
    // Update green bar
    if (this._spBarFill && this._spBarMaxW) {
      const pct = total > 0 ? remaining / total : 0;
      this._spBarFill.setSize(Math.max(1, pct * this._spBarMaxW), 14);
      this._spBarFill.setFillStyle(remaining > 20 ? 0x44aa44 : (remaining > 5 ? 0xaaaa44 : 0xaa4444));
    }
  }

  // ── Respec ───────────────────────────────────────────

  _respecCurrent() {
    if (!this._selectedTree) return;
    if (getTreePointsSpent(this._selectedTree) === 0) return;
    respecTree(this._selectedTree);
    if (typeof GameAudio !== 'undefined') GameAudio.hurt();
    this._afterChange(this._selectedTree);
  }

  // ── Close ────────────────────────────────────────────

  _close() {
    if (typeof GameAudio !== 'undefined') GameAudio.menuOpen();
    this.scene.stop();
    this.scene.resume('WorldScene');
  }
}
