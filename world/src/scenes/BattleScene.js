// ═══════════════════════════════════════════════════
// BATTLE SCENE — DOM Theatre (testroom2 port)
// Phaser scene shell for lifecycle; all rendering via BattleUI
// Game logic: dice-engine, card-abilities, willpower, resources
// ═══════════════════════════════════════════════════

class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }
  init(data) { this.battleData = data; }

  create() {
    // Hide Phaser canvas rendering — battle is 100% DOM
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    if (!B) { this.endBattle(false); return; }

    // Apply buff/fortune effects
    if (typeof applyBuffsToBattle === 'function') applyBuffsToBattle();
    if (typeof applyFortuneToBattle === 'function') applyFortuneToBattle();

    // Team setup
    this._playerTeam = B.red ? 'red' : 'player';
    this._enemyTeam = B.red ? 'blue' : 'enemy';
    const pTeam = B[this._playerTeam];
    const eTeam = B[this._enemyTeam];
    if (!pTeam || !eTeam) { this.endBattle(false); return; }

    this.pg = activeGhost(pTeam);
    this.eg = activeGhost(eTeam);
    if (!this.pg || !this.eg) { this.endBattle(false); return; }

    B.battleStarted = true;
    this.roundNum = 0;
    this._rolling = false;

    // ═══════ OPEN DOM BATTLE THEATRE ═══════
    if (typeof BattleUI !== 'undefined') {
      // Enrich ghosts with art paths from ALL_CARDS
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

      BattleUI.open(pTeam.ghosts, eTeam.ghosts, pTeam.activeIdx, eTeam.activeIdx);
      BattleUI.onFightClick(() => this.doRound());
      BattleUI.onRunClick(() => this.endBattle(false));
    }

    // Open battle log
    if (typeof BattleLog !== 'undefined') {
      BattleLog.open();
      BattleLog.clear();
      const header = this.battleData.trainerName
        ? `${this.battleData.trainerName} challenges you!`
        : `Wild ${this.eg.name} appears!`;
      BattleLog.add(header, 'system');
    }

    // Fire initial entry effects
    if (typeof triggerEntry === 'function') {
      const pCallouts = triggerEntry(pTeam, this._playerTeam);
      const eCallouts = triggerEntry(eTeam, this._enemyTeam);
      [...(pCallouts || []), ...(eCallouts || [])].forEach(c => {
        if (c && c.desc && typeof BattleLog !== 'undefined') BattleLog.add(c.desc, 'ability');
      });
    }

    // Raid setup
    this._raidId = this.battleData.raidId || null;
  }

  // ═══════ COMBAT ROUND ═══════

  doRound() {
    if (!B || !this.pg || !this.eg) return;
    if (this.pg.hp <= 0 || this.eg.hp <= 0) return;
    if (this._rolling) return;
    this._rolling = true;
    this.roundNum++;
    if (typeof BattleUI !== 'undefined') BattleUI.setFightEnabled(false);
    if (typeof GameAudio !== 'undefined') GameAudio.dice();

    // Pre-roll abilities
    if (typeof triggerPreRoll === 'function') {
      const pC = triggerPreRoll(this._playerTeam, (msg) => { if (typeof BattleLog !== 'undefined') BattleLog.add(msg, 'ability'); });
      const eC = triggerPreRoll(this._enemyTeam, (msg) => { if (typeof BattleLog !== 'undefined') BattleLog.add(msg, 'ability'); });
      this.pg = activeGhost(B[this._playerTeam]);
      this.eg = activeGhost(B[this._enemyTeam]);
      this.syncUI();
    }

    // Pre-roll KO check
    if (this.pg.hp <= 0 || this.pg.ko) { this._rolling = false; this.time.delayedCall(600, () => this.checkKOSwap()); return; }
    if (this.eg.hp <= 0 || this.eg.ko) { this._rolling = false; this.time.delayedCall(600, () => this.handleEnemyKO()); return; }

    // Dice count
    const pDiceCount = typeof calculateDiceCount === 'function' ? calculateDiceCount(this._playerTeam) : 3;
    const eDiceCount = typeof calculateDiceCount === 'function' ? calculateDiceCount(this._enemyTeam) : 3;

    // Roll
    const pDice = weightedRoll(B[this._playerTeam], pDiceCount);
    const eDice = weightedRoll(B[this._enemyTeam], eDiceCount);

    // Moonstone / Lucky Stone
    if (B._moonstoneReady && B._moonstoneReady[this._playerTeam]) {
      if (typeof smartMoonstoneChange === 'function') smartMoonstoneChange(pDice);
    }
    if (B._luckyStoneReady && B._luckyStoneReady[this._playerTeam]) {
      if (typeof smartLuckyStone === 'function') smartLuckyStone(pDice);
    }

    if (!B.lastRollDiceCount) B.lastRollDiceCount = {};
    B.lastRollDiceCount[this._playerTeam] = pDiceCount;
    B.lastRollDiceCount[this._enemyTeam] = eDiceCount;

    // Show dice with tumble → then resolve
    if (typeof BattleUI !== 'undefined') {
      // Clear old dice first
      BattleUI.clearDice && BattleUI.clearDice('player');
      BattleUI.clearDice && BattleUI.clearDice('enemy');

      // Quick tumble delay then show final
      setTimeout(() => {
        BattleUI.showDice('player', pDice, false);
        BattleUI.showDice('enemy', eDice, false);
        this.resolveDice(pDice, eDice);
      }, 500);
    } else {
      this.time.delayedCall(500, () => this.resolveDice(pDice, eDice));
    }
  }

  resolveDice(pDice, eDice) {
    const pRes = classify(pDice);
    const eRes = classify(eDice);

    const pF = activeGhost(B[this._playerTeam]);
    const eF = activeGhost(B[this._enemyTeam]);
    const hectorActive = (pF && pF.id === 96 && !pF.ko) || (eF && eF.id === 96 && !eF.ko);
    const winner = compareRolls(pRes, eRes, pDice, eDice, hectorActive);

    const pWin = winner === 'red' || winner === this._playerTeam;
    const eWin = winner === 'blue' || winner === this._enemyTeam;

    // Roll announcement — dramatic per roll type
    if (typeof RollAnnouncer !== 'undefined') {
      const pAnn = RollAnnouncer.announce(pRes, pWin, 'red');
      const eAnn = RollAnnouncer.announce(eRes, eWin, 'blue');

      if (typeof BattleUI !== 'undefined') {
        BattleUI.showDice('player', pDice, pWin);
        BattleUI.showDice('enemy', eDice, eWin);
        BattleUI.showRollResult('player', RollAnnouncer.formatResult(pRes), pWin);
        BattleUI.showRollResult('enemy', RollAnnouncer.formatResult(eRes), eWin);
      }

      // Screen shake for big rolls
      if (pAnn.shake && pWin) this.cameras.main.shake(pAnn.shake.duration, pAnn.shake.intensity);
      if (eAnn.shake && eWin) this.cameras.main.shake(eAnn.shake.duration, eAnn.shake.intensity);
    }

    // Log the roll
    const logText = `R${this.roundNum}: ${describeRoll(pRes)} vs ${describeRoll(eRes)}`;

    if (pWin) {
      // Player wins
      const dmg = typeof calculateDamage === 'function' ? calculateDamage(this._playerTeam, pRes, pDice) : pRes.damage;
      const dodged = typeof checkSylviaDodge === 'function' && checkSylviaDodge(this._enemyTeam);

      if (dodged) {
        if (typeof BattleLog !== 'undefined') BattleLog.add(logText + ' — DODGED!', 'dodge');
        if (typeof BattleUI !== 'undefined') BattleUI.showCallout('DODGE!', 'heal');
      } else {
        const reduction = typeof calculateDamageReduction === 'function' ? calculateDamageReduction(this._enemyTeam, pRes) : 0;
        const finalDmg = Math.max(1, dmg - reduction);

        wpDamage(this.eg, finalDmg);
        if (this.eg.ko) this.eg.killedBy = this.pg.id;

        if (typeof BattleLog !== 'undefined') BattleLog.add(`${logText} — ${finalDmg} dmg to ${this.eg.name}!`, 'damage');
        if (typeof GameAudio !== 'undefined') GameAudio.hit();

        if (finalDmg >= 4 && typeof BattleUI !== 'undefined') {
          BattleUI.showCallout(`-${finalDmg} DAMAGE`, finalDmg >= 6 ? 'critical' : 'damage');
        }

        this.reportRaidDamage(finalDmg, pDice);
        if (typeof triggerWinPath === 'function') triggerWinPath(this._playerTeam, pRes);
      }
    } else if (eWin) {
      // Enemy wins
      const dmg = typeof calculateDamage === 'function' ? calculateDamage(this._enemyTeam, eRes, eDice) : eRes.damage;
      const pDodged = typeof checkSylviaDodge === 'function' && checkSylviaDodge(this._playerTeam);

      if (pDodged) {
        if (typeof BattleLog !== 'undefined') BattleLog.add(logText + ' — DODGED!', 'dodge');
        if (typeof BattleUI !== 'undefined') BattleUI.showCallout('DODGE!', 'heal');
      } else {
        const reduction = typeof calculateDamageReduction === 'function' ? calculateDamageReduction(this._playerTeam, eRes) : 0;
        const finalDmg = Math.max(1, dmg - reduction);

        wpDamage(this.pg, finalDmg);
        if (typeof BattleLog !== 'undefined') BattleLog.add(`${logText} — ${finalDmg} dmg to ${this.pg.name}!`, 'damage');
        if (typeof GameAudio !== 'undefined') GameAudio.hurt();
        if (finalDmg >= 4 && typeof BattleUI !== 'undefined') BattleUI.showCallout(`-${finalDmg}`, 'damage');
      }

      if (typeof triggerWinPath === 'function') triggerWinPath(this._enemyTeam, eRes);
      if (typeof triggerOnLoss === 'function') triggerOnLoss(this._playerTeam);
    } else {
      if (typeof BattleLog !== 'undefined') BattleLog.add(logText + ' — Tie!', 'system');
    }

    // Sync UI
    this.syncUI();

    // Reset
    if (typeof resetRoundFlags === 'function') resetRoundFlags();
    this._rolling = false;
    if (typeof BattleUI !== 'undefined') BattleUI.setFightEnabled(true);

    // Refresh active refs
    this.pg = activeGhost(B[this._playerTeam]);
    this.eg = activeGhost(B[this._enemyTeam]);

    // KO check
    if (this.eg.hp <= 0 || this.eg.ko) {
      this.time.delayedCall(600, () => this.handleEnemyKO());
    } else if (this.pg.hp <= 0 || this.pg.ko) {
      this.time.delayedCall(600, () => this.checkKOSwap());
    }
  }

  // ═══════ SYNC UI STATE ═══════

  syncUI() {
    if (typeof BattleUI === 'undefined') return;
    BattleUI.updateHP('player', this.pg.hp, this.pg.maxHp);
    BattleUI.updateHP('enemy', this.eg.hp, this.eg.maxHp);
    BattleUI.updateFighter('player', this.pg);
    BattleUI.updateFighter('enemy', this.eg);
    BattleUI.updateSideline('player', B[this._playerTeam].ghosts, B[this._playerTeam].activeIdx);
    BattleUI.updateSideline('enemy', B[this._enemyTeam].ghosts, B[this._enemyTeam].activeIdx);
    const res = B[this._playerTeam].resources;
    BattleUI.updateResources(res);
  }

  // ═══════ KO HANDLING ═══════

  handleEnemyKO() {
    this.eg.ko = true;
    if (typeof BattleUI !== 'undefined') BattleUI.showCallout('KO!', 'ko');
    if (typeof BattleLog !== 'undefined') BattleLog.add(`${this.eg.name} has fallen!`, 'ko');

    const eTeam = B[this._enemyTeam];
    const eLiving = eTeam.ghosts.filter((g, i) => i !== eTeam.activeIdx && !g.ko && g.hp > 0);
    if (eLiving.length > 0) {
      const nextIdx = typeof smartPickSwap === 'function'
        ? smartPickSwap(this._enemyTeam) : eTeam.ghosts.indexOf(eLiving[0]);
      if (nextIdx >= 0) {
        if (typeof performKOSwap === 'function') {
          performKOSwap(this._enemyTeam, nextIdx, (msg) => { if (typeof BattleLog !== 'undefined') BattleLog.add(msg, 'system'); });
        } else {
          eTeam.activeIdx = nextIdx;
        }
        this.eg = activeGhost(eTeam);
        if (typeof triggerEntry === 'function') triggerEntry(eTeam, this._enemyTeam);
        this.syncUI();
      }
    } else {
      this.endBattle(true);
    }
  }

  checkKOSwap() {
    this.pg.ko = true;
    this.pg.hp = 0;
    if (typeof BattleUI !== 'undefined') BattleUI.showCallout('KO!', 'ko');
    if (typeof BattleLog !== 'undefined') BattleLog.add(`${this.pg.name} has fallen!`, 'ko');

    const pTeam = B[this._playerTeam];
    const living = [];
    pTeam.ghosts.forEach((g, i) => {
      if (!g.ko && g.hp > 0 && i !== pTeam.activeIdx) living.push({ ghost: g, idx: i });
    });
    if (living.length === 0) { this.endBattle(false); return; }
    this.showKOSwapPicker(living);
  }

  showKOSwapPicker(living) {
    const pickerGhosts = living.map(entry => {
      const g = entry.ghost;
      let art = g.art || '';
      if (!art && typeof ALL_CARDS !== 'undefined') {
        const card = ALL_CARDS.find(c => c.id === g.id);
        if (card && card.art) art = card.art;
      }
      return { id: g.id, name: g.name, hp: g.hp, maxHp: g.maxHp, art,
        ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common', _idx: entry.idx };
    });

    const doSwap = (chosen) => {
      const entry = living.find(e => e.idx === chosen._idx);
      if (!entry) return;
      if (typeof performKOSwap === 'function') {
        performKOSwap(this._playerTeam, entry.idx, (msg) => { if (typeof BattleLog !== 'undefined') BattleLog.add(msg, 'system'); });
      } else {
        B[this._playerTeam].activeIdx = entry.idx;
      }
      this.pg = activeGhost(B[this._playerTeam]);
      if (typeof triggerEntry === 'function') triggerEntry(B[this._playerTeam], this._playerTeam);
      this.syncUI();
      this._rolling = false;
    };

    if (typeof KOPicker !== 'undefined') {
      KOPicker.show(pickerGhosts, doSwap);
    } else if (typeof BattleUI !== 'undefined' && BattleUI.showKOPicker) {
      BattleUI.showKOPicker(pickerGhosts, doSwap);
    } else {
      doSwap(pickerGhosts[0]); // auto-pick fallback
    }
  }

  // ═══════ END BATTLE ═══════

  endBattle(won) {
    // Close all DOM overlays
    if (typeof BattleUI !== 'undefined') BattleUI.close();
    if (typeof BattleLog !== 'undefined') BattleLog.close();
    if (typeof BattleDice !== 'undefined') BattleDice.hide();

    let leveledUp = false, xpGain = 0, coinChange = 0;

    // Only Healing Seeds persist
    const pTeam = B ? B[this._playerTeam] : null;
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

    // Result banner via BattleCallout
    if (typeof BattleCallout !== 'undefined') {
      const type = won ? 'ability' : 'ko';
      const text = won ? 'VICTORY!' : 'DEFEAT';
      let subtitle = '';
      if (won) { subtitle = `+${xpGain} XP  +${coinChange} Gold`; if (leveledUp) subtitle += `  LEVEL ${G.level}!`; }
      else if (coinChange < 0) { subtitle = `${coinChange} Gold`; }
      BattleCallout.show(text, { type, subtitle, duration: 2500, onDone: () => {
        if (typeof GameAudio !== 'undefined') { won ? GameAudio.victory() : GameAudio.defeat(); }
        this.scene.stop();
        this.scene.resume('WorldScene');
        this.scene.get('WorldScene')?.cameras?.main?.fadeIn(300);
      }});
    } else {
      if (typeof GameAudio !== 'undefined') { won ? GameAudio.victory() : GameAudio.defeat(); }
      this.time.delayedCall(1500, () => {
        this.scene.stop();
        this.scene.resume('WorldScene');
      });
    }
  }

  // ═══════ HELPERS ═══════

  reportRaidDamage(dmg, dice) {
    if (!this._raidId || typeof RaidManager === 'undefined') return;
    RaidManager.reportDamage(this._raidId, dmg, dice);
  }

  // Legacy stubs — no longer needed with DOM rendering
  updateHP() { this.syncUI(); }
  refreshWillpowerStacks() {}
  renderSideline() {}
  buildResourceBar() {}
  rebuildResourceBar() {}
  showFloatingText() {}
  flashScreen() {}
  buildRaidPartyStrip() {}
  showRaidFeedEntry() {}
  renderWillpowerStack() {}
}
