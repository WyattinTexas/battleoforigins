// ═══════════════════════════════════════════════════
// BATTLE SCENE — Powered by testroom2 battle engine
// Willpower system, card abilities, weighted dice
// ═══════════════════════════════════════════════════

class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }

  init(data) { this.battleData = data; }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Transparent camera — world scene bleeds through underneath
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.add.rectangle(W / 2, H / 2, W, H, 0xEBE7E3, 0.72).setDepth(-1).setScrollFactor(0);

    if (!B) { this.endBattle(false); return; }

    // ── Raid setup ──
    this._raidId = this.battleData.raidId || null;
    this._raidFeedTexts = [];
    if (this._raidId && typeof RaidManager !== 'undefined') {
      RaidManager._onFeedEntry = (entry) => this.showRaidFeedEntry(entry);
      this.buildRaidPartyStrip(W);
    }

    // Apply buff effects at battle start
    if (typeof applyBuffsToBattle === 'function') applyBuffsToBattle();
    if (typeof applyFortuneToBattle === 'function') applyFortuneToBattle();

    // Determine team names (new engine uses red/blue)
    this._playerTeam = B.red ? 'red' : 'player';
    this._enemyTeam = B.red ? 'blue' : 'enemy';

    const pTeam = B[this._playerTeam];
    const eTeam = B[this._enemyTeam];
    if (!pTeam || !eTeam) { this.endBattle(false); return; }

    this.pg = activeGhost(pTeam);
    this.eg = activeGhost(eTeam);
    if (!this.pg || !this.eg) { this.endBattle(false); return; }

    // Mark battle as started (for entry effects that only fire mid-battle)
    B.battleStarted = true;

    // ── Header ──
    const headerText = this.battleData.trainerName
      ? `${this.battleData.trainerName} challenges you!`
      : `Wild ${this.eg.name} appears!`;
    this.add.text(W / 2, 28, headerText, {
      fontSize: '24px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#222',
    }).setOrigin(0.5);

    // ═══════ PLAYER CARD (LEFT) ═══════
    const pX = W * 0.25, pY = H * 0.40;
    this.add.rectangle(pX + 3, pY + 3, 180, 250, 0x000000, 0.15);
    this.add.rectangle(pX, pY, 184, 254, 0x333333);
    this.add.rectangle(pX, pY, 180, 250, 0x1a1a2e);
    const pArtKey = `card_${this.pg.id}`;
    if (this.textures.exists(pArtKey)) {
      this.add.image(pX, pY, pArtKey).setDisplaySize(170, 240).setFlipX(true);
    } else {
      this.add.text(pX, pY, this.pg.name, { fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
    }

    // ═══════ ENEMY CARD (RIGHT) ═══════
    const eX = W * 0.75, eY = H * 0.40;
    this.add.rectangle(eX + 3, eY + 3, 180, 250, 0x000000, 0.15);
    this.add.rectangle(eX, eY, 184, 254, 0x333333);
    this.add.rectangle(eX, eY, 180, 250, 0x1a2e1a);
    const eArtKey = `card_${this.eg.id}`;
    if (this.textures.exists(eArtKey)) {
      this.add.image(eX, eY, eArtKey).setDisplaySize(170, 240);
    } else {
      this.add.text(eX, eY, this.eg.name, { fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
    }

    // ═══════ WILLPOWER STACKS ═══════
    this._wpPlayerObjs = [];
    this._wpEnemyObjs = [];
    this.renderWillpowerStack(pX + 110, pY + 60, this._playerTeam, this._wpPlayerObjs, true);
    this.renderWillpowerStack(eX - 110, eY + 60, this._enemyTeam, this._wpEnemyObjs, false);

    // ═══════ HP / WILLPOWER DISPLAYS ═══════
    this.playerHPText = this.add.text(pX, pY + 140, `${this.pg.name}  WP ${this.pg.hp}`, {
      fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#222',
    }).setOrigin(0.5);
    this.playerHPBarBg = this.add.rectangle(pX, pY + 155, 160, 7, 0x333333);
    this.playerHPBar = this.add.rectangle(pX - 80, pY + 155, 160, 5, 0x44aa44).setOrigin(0, 0.5);

    this.enemyHPText = this.add.text(eX, eY - 135, `${this.eg.name}  WP ${this.eg.hp}`, {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#222',
    }).setOrigin(0.5);
    this.enemyHPBarBg = this.add.rectangle(eX, eY - 120, 160, 7, 0x333333);
    this.enemyHPBar = this.add.rectangle(eX - 80, eY - 120, 160, 5, 0x44aa44).setOrigin(0, 0.5);

    // ═══════ DICE DISPLAY ═══════
    this.playerDice = [];
    this.enemyDice = [];
    const diceY = H * 0.74;
    for (let i = 0; i < 6; i++) { // support up to 6 dice now
      const pdBg = this.add.rectangle(pX - 70 + i * 30, diceY, 26, 26, 0x3378cc, i < 3 ? 1 : 0).setStrokeStyle(2, 0x2060a0);
      const pdTxt = this.add.text(pX - 70 + i * 30, diceY, '', {
        fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5);
      this.playerDice.push({ bg: pdBg, txt: pdTxt });

      const edBg = this.add.rectangle(eX - 70 + i * 30, diceY, 26, 26, 0xcc4444, i < 3 ? 1 : 0).setStrokeStyle(2, 0xa03030);
      const edTxt = this.add.text(eX - 70 + i * 30, diceY, '', {
        fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5);
      this.enemyDice.push({ bg: edBg, txt: edTxt });
    }
    this.add.text(pX, diceY - 20, 'PLAYER', { fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3366aa' }).setOrigin(0.5);
    this.add.text(eX, diceY - 20, 'ENEMY', { fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#aa3333' }).setOrigin(0.5);

    // ═══════ RESOURCE TILES ═══════
    this._resourceBtns = [];
    this.buildResourceBar();

    // ═══════ BATTLE LOG ═══════
    this.logText = this.add.text(W / 2, H * 0.88, 'Press FIGHT to roll!', {
      fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#555',
      wordWrap: { width: W * 0.7 },
    }).setOrigin(0.5);

    // ═══════ FIGHT BUTTON ═══════
    this.fightBg = this.add.rectangle(W * 0.72, H * 0.95, 120, 40, 0x222222)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x444444);
    this.add.text(W * 0.72, H * 0.95, 'FIGHT', {
      fontSize: '20px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5);
    this.fightBg.on('pointerover', () => { if (!this._rolling) this.fightBg.setFillStyle(0x444444); });
    this.fightBg.on('pointerout', () => this.fightBg.setFillStyle(0x222222));
    this.fightBg.on('pointerdown', () => this.doRound());

    // ═══════ RUN BUTTON ═══════
    const rBg = this.add.rectangle(W * 0.88, H * 0.95, 90, 40, 0x993322)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x664422);
    this.add.text(W * 0.88, H * 0.95, 'RUN', {
      fontSize: '20px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5);
    rBg.on('pointerover', () => rBg.setFillStyle(0xbb4433));
    rBg.on('pointerout', () => rBg.setFillStyle(0x993322));
    rBg.on('pointerdown', () => this.endBattle(false));

    // ═══════ STATE ═══════
    this.roundNum = 0;
    this._rolling = false;

    // Fire initial entry effects
    if (typeof triggerEntry === 'function') {
      const pCallouts = triggerEntry(pTeam, this._playerTeam);
      const eCallouts = triggerEntry(eTeam, this._enemyTeam);
      // Show entry callouts via log
      [...pCallouts, ...eCallouts].forEach(c => {
        if (c && c.desc) this.showFloatingText(W / 2, H * 0.15, c.name, c.color || '#ffcc00');
      });
    }
  }

  // ═══════ WILLPOWER STACK VISUAL ═══════

  renderWillpowerStack(x, y, teamName, objArray, isPlayer) {
    // Clear old
    objArray.forEach(o => o.destroy());
    objArray.length = 0;

    const team = B[teamName];
    if (!team) return;
    const f = activeGhost(team);
    if (!f || !f.willpower) return;

    const count = f.willpower.length;
    const showCount = Math.min(count, 6);

    // Stacked cards (bottom to top, 4px offset each)
    for (let i = 0; i < showCount; i++) {
      const cardY = y - i * 4;
      const isTop = (i === showCount - 1);
      const cardId = f.willpower[i];
      const card = typeof wpCardById === 'function' ? wpCardById(cardId) : null;

      const colors = { red: 0xcc4444, blue: 0x4488cc, green: 0x44aa44, orange: 0xcc8833 };
      const cardColor = card ? (colors[card.color] || 0x555555) : 0x555555;

      const rect = this.add.rectangle(x, cardY, 40, 20, cardColor, isTop ? 0.9 : 0.5)
        .setStrokeStyle(isTop ? 2 : 1, isTop ? 0xffffff : 0x888888);
      objArray.push(rect);

      if (isTop && card) {
        const emoji = this.add.text(x, cardY, card.emoji || '?', {
          fontSize: '12px',
        }).setOrigin(0.5);
        objArray.push(emoji);

        // Clickable for player (activate willpower)
        if (isPlayer && !f.willpowerTopLocked && !(B.wpUsedThisTurn && B.wpUsedThisTurn[teamName])) {
          rect.setInteractive({ useHandCursor: true });
          rect.on('pointerover', () => rect.setStrokeStyle(2, 0xffcc00));
          rect.on('pointerout', () => rect.setStrokeStyle(2, 0xffffff));
          rect.on('pointerdown', () => {
            if (this._rolling) return;
            const activated = typeof activateWillpower === 'function'
              ? activateWillpower(team, teamName, (msg) => this.logText.setText(msg))
              : null;
            if (activated) {
              this.pg = activeGhost(B[this._playerTeam]);
              this.eg = activeGhost(B[this._enemyTeam]);
              this.updateHP();
              this.refreshWillpowerStacks();
              this.rebuildResourceBar();
              if (typeof GameAudio !== 'undefined') GameAudio.collect();
            }
          });
        } else if (f.willpowerTopLocked) {
          rect.setAlpha(0.35);
        }
      }
    }

    // Count label
    const label = this.add.text(x, y + 16, `${count} WP`, {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#333',
    }).setOrigin(0.5);
    objArray.push(label);

    // Deck/discard counts
    const deckCount = team.wpDeck ? team.wpDeck.length : 0;
    const discardCount = team.wpDiscard ? team.wpDiscard.length : 0;
    const deckLabel = this.add.text(x, y + 28, `D:${deckCount} X:${discardCount}`, {
      fontSize: '7px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5);
    objArray.push(deckLabel);
  }

  refreshWillpowerStacks() {
    const pX = this.scale.width * 0.25 + 110;
    const eX = this.scale.width * 0.75 - 110;
    const y = this.scale.height * 0.40 + 60;
    this.renderWillpowerStack(pX, y, this._playerTeam, this._wpPlayerObjs, true);
    this.renderWillpowerStack(eX, y, this._enemyTeam, this._wpEnemyObjs, false);
  }

  // ═══════ RESOURCE BAR ═══════

  buildResourceBar() {
    const W = this.scale.width;
    const resY = this.scale.height * 0.82;
    const team = B[this._playerTeam];
    if (!team || !team.resources) return;

    const defs = typeof RESOURCE_DISPLAY !== 'undefined' ? RESOURCE_DISPLAY : {};
    const keys = ['ice', 'fire', 'surge', 'moonstone', 'luckyStone', 'healingSeed', 'burn', 'firefly'];
    const available = keys.filter(k => (team.resources[k] || 0) > 0);
    if (available.length === 0) return;

    const startX = W / 2 - (available.length * 54) / 2;
    available.forEach((key, i) => {
      const x = startX + i * 54 + 27;
      const count = team.resources[key] || 0;
      const info = defs[key] || { emoji: '?', label: key, color: '#888' };
      const hexColor = parseInt((info.color || '#888888').replace('#', ''), 16);

      const bg = this.add.rectangle(x, resY, 48, 32, hexColor, 0.25)
        .setStrokeStyle(1, hexColor).setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, resY - 4, info.emoji || '?', { fontSize: '14px' }).setOrigin(0.5);
      const countTxt = this.add.text(x, resY + 11, `${count}`, {
        fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5);

      const committable = ['ice', 'fire', 'surge'];
      if (committable.includes(key)) {
        bg.on('pointerdown', () => {
          if (this._rolling) return;
          if (typeof cycleCommit === 'function') {
            const newCount = cycleCommit(this._playerTeam, key);
            this.rebuildResourceBar();
            if (typeof GameAudio !== 'undefined') GameAudio.collect();
          }
        });
      } else if (key === 'healingSeed') {
        bg.on('pointerdown', () => {
          if (this._rolling) return;
          if (typeof spendHealingSeed === 'function') {
            spendHealingSeed(this._playerTeam, (msg) => this.logText.setText(msg));
            this.updateHP();
            this.refreshWillpowerStacks();
            this.rebuildResourceBar();
            if (typeof GameAudio !== 'undefined') GameAudio.heal();
          }
        });
      }

      this._resourceBtns.push({ bg, txt, countTxt });
    });
  }

  rebuildResourceBar() {
    this._resourceBtns.forEach(b => { b.bg.destroy(); b.txt.destroy(); if (b.countTxt) b.countTxt.destroy(); });
    this._resourceBtns = [];
    this.buildResourceBar();
  }

  // ═══════ COMBAT ROUND (New Engine) ═══════

  doRound() {
    if (!B || !this.pg || !this.eg) return;
    if (this.pg.hp <= 0 || this.eg.hp <= 0) return;
    if (this._rolling) return;
    this._rolling = true;
    this.roundNum++;
    this.fightBg.setFillStyle(0x111111);
    GameAudio.dice();

    // Pre-roll abilities (chip damage, entry effects)
    if (typeof triggerPreRoll === 'function') {
      const pCallouts = triggerPreRoll(this._playerTeam, (msg) => this.logText.setText(msg));
      const eCallouts = triggerPreRoll(this._enemyTeam, (msg) => this.logText.setText(msg));
      [...pCallouts, ...eCallouts].forEach(c => {
        if (c && c.desc) this.showFloatingText(this.scale.width / 2, this.scale.height * 0.15, c.name, c.color || '#ff6644');
      });
      // Refresh HP after chip damage
      this.pg = activeGhost(B[this._playerTeam]);
      this.eg = activeGhost(B[this._enemyTeam]);
      this.updateHP();
      this.refreshWillpowerStacks();
    }

    // Check if pre-roll killed someone
    if (this.pg.hp <= 0 || this.pg.ko) {
      this._rolling = false;
      this.time.delayedCall(600, () => this.checkKOSwap());
      return;
    }
    if (this.eg.hp <= 0 || this.eg.ko) {
      this._rolling = false;
      this.time.delayedCall(600, () => this.handleEnemyKO());
      return;
    }

    // Calculate dice count (all modifiers from card-abilities.js)
    const pDiceCount = typeof calculateDiceCount === 'function'
      ? calculateDiceCount(this._playerTeam) : 3;
    const eDiceCount = 3;

    // Roll with cinematic weighting
    const pTeam = B[this._playerTeam];
    const eTeam = B[this._enemyTeam];
    const pDice = weightedRoll(pTeam, pDiceCount);
    const eDice = weightedRoll(eTeam, eDiceCount);

    // Moonstone: optimize die change
    if (B.committed && B.committed[this._playerTeam] &&
        (B.committed[this._playerTeam].moonstone || (pTeam.resources.moonstone > 0 && B.committed[this._playerTeam].moonstone))) {
      // Auto moonstone for now — later add interactive picker
      if (typeof smartMoonstoneChange === 'function') smartMoonstoneChange(pDice);
    }

    // Lucky Stone: reroll lowest
    if (B.committed && B.committed[this._playerTeam] && B.committed[this._playerTeam].luckyStone) {
      if (typeof smartLuckyStone === 'function') smartLuckyStone(pDice);
    }

    // Store dice count for Antoinette mirroring
    if (!B.lastRollDiceCount) B.lastRollDiceCount = {};
    B.lastRollDiceCount[this._playerTeam] = pDiceCount;
    B.lastRollDiceCount[this._enemyTeam] = eDiceCount;

    // ── Dice tumble animation ──
    const tumbles = 6;
    const tumbleMs = 60;
    // Show/hide dice slots based on count
    for (let i = 0; i < 6; i++) {
      if (this.playerDice[i]) {
        this.playerDice[i].bg.setAlpha(i < pDiceCount ? 1 : 0);
        this.playerDice[i].txt.setAlpha(i < pDiceCount ? 1 : 0);
      }
      if (this.enemyDice[i]) {
        this.enemyDice[i].bg.setAlpha(i < eDiceCount ? 1 : 0);
        this.enemyDice[i].txt.setAlpha(i < eDiceCount ? 1 : 0);
      }
    }

    for (let t = 0; t < tumbles; t++) {
      this.time.delayedCall(t * tumbleMs, () => {
        for (let i = 0; i < Math.max(pDiceCount, eDiceCount); i++) {
          if (i < pDiceCount && this.playerDice[i]) this.playerDice[i].txt.setText(Phaser.Math.Between(1, 6));
          if (i < eDiceCount && this.enemyDice[i]) this.enemyDice[i].txt.setText(Phaser.Math.Between(1, 6));
        }
      });
    }

    this.time.delayedCall(tumbles * tumbleMs + 50, () => this.resolveDice(pDice, eDice));
  }

  resolveDice(pDice, eDice) {
    // Show real values with pop animation
    for (let i = 0; i < 6; i++) {
      if (this.playerDice[i]) {
        this.playerDice[i].txt.setText(pDice[i] !== undefined ? pDice[i] : '');
        if (pDice[i] !== undefined) {
          this.tweens.add({ targets: [this.playerDice[i].bg, this.playerDice[i].txt], scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true });
        }
      }
      if (this.enemyDice[i]) {
        this.enemyDice[i].txt.setText(eDice[i] !== undefined ? eDice[i] : '');
        if (eDice[i] !== undefined) {
          this.tweens.add({ targets: [this.enemyDice[i].bg, this.enemyDice[i].txt], scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true, delay: 100 });
        }
      }
    }

    const pRes = classify(pDice);
    const eRes = classify(eDice);

    // Hector check for singles-beats-doubles
    const pF = activeGhost(B[this._playerTeam]);
    const eF = activeGhost(B[this._enemyTeam]);
    const hectorActive = (pF && pF.id === 96 && !pF.ko) || (eF && eF.id === 96 && !eF.ko);

    const winner = compareRolls(pRes, eRes, pDice, eDice, hectorActive);

    // Type label for display
    const pLabel = typeof typeLabel === 'function' ? typeLabel(pRes.type) : '';
    const eLabel = typeof typeLabel === 'function' ? typeLabel(eRes.type) : '';
    let log = `R${this.roundNum}: ${describeRoll(pRes)} vs ${describeRoll(eRes)}`;

    if (winner === 'red' || winner === this._playerTeam) {
      // Player wins — calculate full damage
      const dmg = typeof calculateDamage === 'function'
        ? calculateDamage(this._playerTeam, pRes, pDice) : pRes.damage;

      // Check dodge
      const dodged = typeof checkSylviaDodge === 'function' && checkSylviaDodge(this._enemyTeam);
      if (dodged) {
        log += ' — DODGED!';
        this.showFloatingText(this.scale.width * 0.75, this.scale.height * 0.35, 'DODGE!', '#44ddff');
      } else {
        // Apply damage reduction
        const reduction = typeof calculateDamageReduction === 'function'
          ? calculateDamageReduction(this._enemyTeam, pRes) : 0;
        const finalDmg = Math.max(1, dmg - reduction);

        wpDamage(this.eg, finalDmg);
        if (this.eg.ko) this.eg.killedBy = this.pg.id;
        log += ` — ${finalDmg} dmg to ${this.eg.name}!`;
        if (pLabel) log += ` ${pLabel}`;
        this.cameras.main.shake(80, 0.004);
        this.showFloatingText(this.scale.width * 0.75, this.scale.height * 0.35, `-${finalDmg}`, '#cc2211');
        GameAudio.hit();
        if (finalDmg >= 4) this.flashScreen();
        this.reportRaidDamage(finalDmg, pDice);

        // Win-path abilities
        if (typeof triggerWinPath === 'function') triggerWinPath(this._playerTeam, pRes);
      }
    } else if (winner === 'blue' || winner === this._enemyTeam) {
      // Enemy wins
      const dmg = typeof calculateDamage === 'function'
        ? calculateDamage(this._enemyTeam, eRes, eDice) : eRes.damage;
      const reduction = typeof calculateDamageReduction === 'function'
        ? calculateDamageReduction(this._playerTeam, eRes) : 0;
      const finalDmg = Math.max(1, dmg - reduction);

      wpDamage(this.pg, finalDmg);
      log += ` — ${finalDmg} dmg to ${this.pg.name}!`;
      if (eLabel) log += ` ${eLabel}`;
      this.cameras.main.shake(120, 0.006);
      this.showFloatingText(this.scale.width * 0.25, this.scale.height * 0.35, `-${finalDmg}`, '#cc2211');
      GameAudio.hurt();
      if (finalDmg >= 4) this.flashScreen();

      // Loss-path abilities
      if (typeof triggerOnLoss === 'function') triggerOnLoss(this._playerTeam);
    } else {
      log += ' — Tie!';
    }

    this.logText.setText(log);
    this.updateHP();
    this.refreshWillpowerStacks();

    // Reset round flags
    if (typeof resetRoundFlags === 'function') resetRoundFlags();
    this._rolling = false;
    this.fightBg.setFillStyle(0x222222);
    this.rebuildResourceBar();

    // Refresh active ghost refs
    this.pg = activeGhost(B[this._playerTeam]);
    this.eg = activeGhost(B[this._enemyTeam]);

    // Check KO
    if (this.eg.hp <= 0 || this.eg.ko) {
      this.time.delayedCall(600, () => this.handleEnemyKO());
    } else if (this.pg.hp <= 0 || this.pg.ko) {
      this.time.delayedCall(600, () => this.checkKOSwap());
    }
  }

  // ═══════ KO HANDLING ═══════

  handleEnemyKO() {
    this.eg.ko = true;
    const eTeam = B[this._enemyTeam];
    const eLiving = eTeam.ghosts.filter((g, i) => i !== eTeam.activeIdx && !g.ko && g.hp > 0);
    if (eLiving.length > 0) {
      const nextIdx = typeof smartPickSwap === 'function'
        ? smartPickSwap(this._enemyTeam) : eTeam.ghosts.indexOf(eLiving[0]);
      if (nextIdx >= 0) {
        if (typeof performKOSwap === 'function') {
          performKOSwap(this._enemyTeam, nextIdx, (msg) => this.logText.setText(msg));
        } else {
          eTeam.activeIdx = nextIdx;
        }
        this.eg = activeGhost(eTeam);
        // Trigger entry effects for new enemy
        if (typeof triggerEntry === 'function') triggerEntry(eTeam, this._enemyTeam);
        this.updateHP();
        this.refreshWillpowerStacks();
      }
    } else {
      this.endBattle(true);
    }
  }

  checkKOSwap() {
    this.pg.ko = true;
    this.pg.hp = 0;
    const pTeam = B[this._playerTeam];
    const living = [];
    pTeam.ghosts.forEach((g, i) => {
      if (!g.ko && g.hp > 0 && i !== pTeam.activeIdx) living.push({ ghost: g, idx: i });
    });
    if (living.length === 0) { this.endBattle(false); return; }
    this.showKOSwapPicker(living);
  }

  showKOSwapPicker(living) {
    const W = this.scale.width;
    const H = this.scale.height;
    this._swapUI = [];
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(600).setInteractive();
    this._swapUI.push(backdrop);
    const title = this.add.text(W / 2, H * 0.25, `${this.pg.name} was knocked out!`, {
      fontSize: '22px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ff6644',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(601);
    this._swapUI.push(title);
    this._swapUI.push(this.add.text(W / 2, H * 0.32, 'Choose your next Spiritkin:', {
      fontSize: '16px', fontFamily: 'Georgia, serif', color: '#ccc',
    }).setOrigin(0.5).setDepth(601));

    living.forEach((entry, i) => {
      const y = H * 0.42 + i * 58;
      const g = entry.ghost;
      const row = this.add.rectangle(W / 2, y, 300, 48, 0x222244, 0.8)
        .setStrokeStyle(1, 0x4466aa).setDepth(601).setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setFillStyle(0x333366));
      row.on('pointerout', () => row.setFillStyle(0x222244, 0.8));
      row.on('pointerdown', () => {
        if (typeof performKOSwap === 'function') {
          performKOSwap(this._playerTeam, entry.idx, (msg) => this.logText.setText(msg));
        } else {
          B[this._playerTeam].activeIdx = entry.idx;
        }
        this.pg = activeGhost(B[this._playerTeam]);
        if (typeof triggerEntry === 'function') triggerEntry(B[this._playerTeam], this._playerTeam);
        this._swapUI.forEach(o => o.destroy());
        this._swapUI = [];
        this.updateHP();
        this.refreshWillpowerStacks();
        this._rolling = false;
        this.rebuildResourceBar();
      });
      this._swapUI.push(row);
      this._swapUI.push(this.add.text(W / 2 - 130, y, g.name, {
        fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ff88',
      }).setOrigin(0, 0.5).setDepth(602));
      this._swapUI.push(this.add.text(W / 2 + 130, y, `WP ${g.hp}`, {
        fontSize: '13px', fontFamily: 'monospace', color: '#aaa',
      }).setOrigin(1, 0.5).setDepth(602));
    });
  }

  // ═══════ HELPERS ═══════

  showFloatingText(x, y, text, color) {
    const txt = this.add.text(x, y, text, {
      fontSize: '28px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: color,
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: txt, y: y - 60, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
  }

  flashScreen() {
    const W = this.scale.width, H = this.scale.height;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.6).setDepth(900);
    this.tweens.add({ targets: flash, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
  }

  updateHP() {
    // Player
    this.playerHPText.setText(`${this.pg.name}  WP ${this.pg.hp}`);
    const pPct = this.pg.maxHp > 0 ? this.pg.hp / this.pg.maxHp : 0;
    this.playerHPBar.width = Math.max(0, 160 * pPct);
    this.playerHPBar.setFillStyle(pPct > 0.66 ? 0x44aa44 : pPct > 0.33 ? 0xddaa22 : 0xcc2211);

    // Enemy
    this.enemyHPText.setText(`${this.eg.name}  WP ${this.eg.hp}`);
    const ePct = this.eg.maxHp > 0 ? this.eg.hp / this.eg.maxHp : 0;
    this.enemyHPBar.width = Math.max(0, 160 * ePct);
    this.enemyHPBar.setFillStyle(ePct > 0.66 ? 0x44aa44 : ePct > 0.33 ? 0xddaa22 : 0xcc2211);
  }

  // ═══════ END BATTLE ═══════

  endBattle(won) {
    const W = this.scale.width, H = this.scale.height;
    let leveledUp = false, xpGain = 0, coinChange = 0;

    // Sync resources back to G
    const pTeam = B ? B[this._playerTeam] : null;
    if (pTeam && pTeam.resources) {
      G.iceShards = pTeam.resources.ice ?? G.iceShards;
      G.sacredFire = pTeam.resources.fire ?? G.sacredFire;
      G.healingSeeds = pTeam.resources.healingSeed ?? G.healingSeeds;
      G.luckyStones = pTeam.resources.luckyStone ?? G.luckyStones;
      G.surge = pTeam.resources.surge ?? G.surge;
      G.moonstone = pTeam.resources.moonstone ?? G.moonstone;
      G.firefly = pTeam.resources.firefly ?? G.firefly;
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

    // Sync HP back to team
    if (pTeam) {
      pTeam.ghosts.forEach((ghost, i) => {
        if (G.team[i]) { G.team[i].hp = ghost.hp; G.team[i].ko = ghost.ko; }
      });
    }

    const enemyCard = B?.enemyCard || (this.eg ? ALL_CARDS.find(c => c.id === this.eg.id) : null);
    const isWild = !this.battleData.trainerName;
    G.inBattle = false; B = null;
    if (G.activeBuffs) {
      G.activeBuffs.forEach(b => { if (b.fights > 0) b.fights--; });
      G.activeBuffs = G.activeBuffs.filter(b => b.fights > 0);
    }
    saveGame();

    // Banner
    const bannerText = won ? 'VICTORY!' : 'DEFEAT';
    const bannerColor = won ? '#44dd44' : '#dd4444';
    if (won) { GameAudio.victory(); if (leveledUp) this.time.delayedCall(400, () => GameAudio.levelUp()); }
    else { GameAudio.defeat(); }
    const banner = this.add.text(W / 2, H / 2, bannerText, {
      fontSize: '52px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: bannerColor,
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(500).setAlpha(0).setScale(0.3);
    let subtitle = '';
    if (won) { subtitle = `+${xpGain} XP  +${coinChange} Gold`; if (leveledUp) subtitle += `  LEVEL ${G.level}!`; }
    else if (coinChange < 0) { subtitle = `${coinChange} Gold`; }
    const subText = this.add.text(W / 2, H / 2 + 44, subtitle, {
      fontSize: '16px', fontFamily: 'Georgia, serif', color: won ? '#ccddcc' : '#ccaaaa',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(500).setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: subText, alpha: 1, duration: 300, delay: 300 });

    this.time.delayedCall(1600, () => {
      if (won && isWild && enemyCard) this.showRecruitPrompt(enemyCard, leveledUp);
      else this.transitionOut(leveledUp);
    });
  }

  // ═══════ RECRUIT ═══════

  showRecruitPrompt(enemyCard, leveledUp) {
    const chance = (typeof hasSkill === 'function' && hasSkill('hunter_instinct')) ? 0.6 : 0.4;
    if (Math.random() > chance || G.team.length >= 6) { this.transitionOut(leveledUp); return; }
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.rectangle(W / 2, H / 2 + 100, 400, 80, 0x1a1a2e, 0.95).setStrokeStyle(2, 0x4466aa).setDepth(600);
    const msg = this.add.text(W / 2, H / 2 + 85, `${enemyCard.name} wants to join your team!`, {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#88ff88',
    }).setOrigin(0.5).setDepth(601);
    const cleanup = () => { bg.destroy(); msg.destroy(); accBg.destroy(); accTxt.destroy(); decBg.destroy(); decTxt.destroy(); };
    const accBg = this.add.rectangle(W / 2 - 60, H / 2 + 115, 100, 30, 0x226622).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x44aa44).setDepth(601);
    const accTxt = this.add.text(W / 2 - 60, H / 2 + 115, 'ACCEPT', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(602);
    accBg.on('pointerdown', () => {
      G.team.push({ id: enemyCard.id, name: enemyCard.name, hp: enemyCard.maxHp, maxHp: enemyCard.maxHp, ko: false, ability: enemyCard.ability, abilityDesc: enemyCard.desc || '', rarity: enemyCard.rarity });
      saveGame(); cleanup(); this.transitionOut(leveledUp);
    });
    const decBg = this.add.rectangle(W / 2 + 60, H / 2 + 115, 100, 30, 0x662222).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0xaa4444).setDepth(601);
    const decTxt = this.add.text(W / 2 + 60, H / 2 + 115, 'DECLINE', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(602);
    decBg.on('pointerdown', () => { cleanup(); this.transitionOut(leveledUp); });
  }

  transitionOut(leveledUp) {
    if (this._raidId && typeof RaidManager !== 'undefined') RaidManager.leaveRaid();
    this.cameras.main.fadeOut(400);
    const returnTo = this.battleData.returnScene || 'WorldScene';
    this.time.delayedCall(500, () => {
      this.scene.stop();
      this.scene.resume(returnTo);
      const rs = this.scene.get(returnTo);
      if (rs?.cameras?.main) rs.cameras.main.fadeIn(300);
      if (leveledUp && rs?.showNotification) rs.showNotification(`Level up! Now level ${G.level}!`);
    });
  }

  // ═══════ RAID CO-OP ═══════

  buildRaidPartyStrip(W) {
    if (typeof RaidManager === 'undefined') return;
    const participants = RaidManager.getParticipants();
    const names = Object.values(participants).map(p => p.name);
    if (names.length <= 1) return;
    const label = this.add.text(W / 2, 12, '⚔ RAID: ' + names.join(' • '), {
      fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ccff',
      backgroundColor: '#0a0a2ecc', padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: label, alpha: 0.6, duration: 1200, yoyo: true, repeat: 2 });
  }

  showRaidFeedEntry(entry) {
    if (!entry) return;
    const W = this.scale.width;
    const diceStr = (entry.dice || []).map(d => `[${d}]`).join('');
    const text = `${entry.name}: ${diceStr} → ${entry.damage} dmg`;
    const feedY = 30 + this._raidFeedTexts.length * 18;
    const feedText = this.add.text(W - 10, feedY, text, {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaddff',
      backgroundColor: '#0a0a1eaa', padding: { x: 4, y: 1 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.tweens.add({ targets: feedText, alpha: 1, duration: 300 });
    this._raidFeedTexts.push(feedText);
    this.time.delayedCall(5000, () => {
      this.tweens.add({ targets: feedText, alpha: 0, duration: 500, onComplete: () => {
        feedText.destroy();
        const idx = this._raidFeedTexts.indexOf(feedText);
        if (idx > -1) this._raidFeedTexts.splice(idx, 1);
      }});
    });
    if (this._raidFeedTexts.length > 5) { const old = this._raidFeedTexts.shift(); old.destroy(); }
    const raidHp = RaidManager.getRaidBossHp();
    if (raidHp !== null && this.eg) {
      this.eg.hp = Math.max(0, raidHp);
      this.updateHP();
      if (raidHp <= 0) this.time.delayedCall(600, () => this.endBattle(true));
    }
  }

  reportRaidDamage(damage, pDice) {
    if (!this._raidId || typeof RaidManager === 'undefined') return;
    RaidManager.reportDamage(damage, G.name, pDice);
  }
}
