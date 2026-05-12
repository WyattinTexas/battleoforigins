// ═══════════════════════════════════════════════════
// BATTLE SCENE — Wave 2: dice animation, resources,
// KO swap, recruit, flee penalty, equipment effects
// ═══════════════════════════════════════════════════

class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }

  init(data) { this.battleData = data; }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.cameras.main.setBackgroundColor('#EBE7E3');

    if (!B) { this.endBattle(false); return; }

    // Apply Fortune Teller effects (Good Fortune = +1 LS, Bad Fortune = -1 die flag)
    if (typeof applyFortuneToBattle === 'function') applyFortuneToBattle();

    const pg = activePlayerGhost();
    const eg = activeEnemyGhost();
    if (!pg || !eg) { this.endBattle(false); return; }

    const pCard = ALL_CARDS.find(c => c.id === pg.id);
    const eCard = ALL_CARDS.find(c => c.id === eg.id);

    // ── Header ──
    const headerText = this.battleData.trainerName
      ? `${this.battleData.trainerName} challenges you!`
      : `Wild ${eg.name} appears!`;
    this.add.text(W / 2, 28, headerText, {
      fontSize: '24px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#222',
    }).setOrigin(0.5);

    // ═══════ PLAYER CARD (LEFT) ═══════
    const pX = W * 0.25, pY = H * 0.42;
    this.add.rectangle(pX + 3, pY + 3, 180, 250, 0x000000, 0.15);
    this.add.rectangle(pX, pY, 184, 254, 0x333333);
    this.add.rectangle(pX, pY, 180, 250, 0x1a1a2e);
    const pArtKey = `card_${pg.id}`;
    if (this.textures.exists(pArtKey)) {
      this.add.image(pX, pY, pArtKey).setDisplaySize(170, 240).setFlipX(true);
    } else {
      this.add.text(pX, pY, pg.name, { fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
    }

    // ═══════ ENEMY CARD (RIGHT) ═══════
    const eX = W * 0.75, eY = H * 0.42;
    this.add.rectangle(eX + 3, eY + 3, 180, 250, 0x000000, 0.15);
    this.add.rectangle(eX, eY, 184, 254, 0x333333);
    this.add.rectangle(eX, eY, 180, 250, 0x1a2e1a);
    const eArtKey = `card_${eg.id}`;
    if (this.textures.exists(eArtKey)) {
      this.add.image(eX, eY, eArtKey).setDisplaySize(170, 240);
    } else {
      this.add.text(eX, eY, eg.name, { fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
    }

    // ═══════ LABELS ═══════
    this.add.text(W / 2, H * 0.37, 'YOU', { fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#888' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.45, 'FOE', { fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#888' }).setOrigin(0.5);

    // ═══════ HP DISPLAYS ═══════
    this.playerHPText = this.add.text(pX, pY + 140, `${pg.name}  HP ${pg.hp}/${pg.maxHp}`, {
      fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#222',
    }).setOrigin(0.5);
    this.playerHPBarBg = this.add.rectangle(pX, pY + 155, 160, 7, 0x333333);
    this.playerHPBar = this.add.rectangle(pX - 80, pY + 155, 160, 5, 0x44aa44).setOrigin(0, 0.5);

    this.add.text(eX - 90, eY - 135, eg.name, {
      fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#222',
    }).setOrigin(0, 0.5);
    this.enemyHPText = this.add.text(eX + 90, eY - 135, `HP ${eg.hp}/${eg.maxHp}`, {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#222',
    }).setOrigin(1, 0.5);
    if (eCard?.ability) {
      this.add.text(eX, eY - 120, eCard.ability, {
        fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#666',
      }).setOrigin(0.5);
    }
    this.enemyHPBarBg = this.add.rectangle(eX, eY - 108, 160, 7, 0x333333);
    this.enemyHPBar = this.add.rectangle(eX - 80, eY - 108, 160, 5, 0x44aa44).setOrigin(0, 0.5);

    // ═══════ DICE DISPLAY ═══════
    this.playerDice = [];
    this.enemyDice = [];
    const diceY = H * 0.74;
    for (let i = 0; i < 3; i++) {
      const pdBg = this.add.rectangle(pX - 50 + i * 44, diceY, 38, 38, 0x3378cc).setStrokeStyle(2, 0x2060a0);
      const pdTxt = this.add.text(pX - 50 + i * 44, diceY, '', {
        fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
        shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, fill: true },
      }).setOrigin(0.5);
      this.playerDice.push({ bg: pdBg, txt: pdTxt });

      const edBg = this.add.rectangle(eX - 50 + i * 44, diceY, 38, 38, 0xcc4444).setStrokeStyle(2, 0xa03030);
      const edTxt = this.add.text(eX - 50 + i * 44, diceY, '', {
        fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
        shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, fill: true },
      }).setOrigin(0.5);
      this.enemyDice.push({ bg: edBg, txt: edTxt });
    }
    this.add.text(pX, diceY - 24, 'PLAYER', { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3366aa' }).setOrigin(0.5);
    this.add.text(eX, diceY - 24, 'ENEMY', { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#aa3333' }).setOrigin(0.5);

    // ═══════ RESOURCE BAR ═══════
    this._resourceBtns = [];
    this.buildResourceBar();

    // ═══════ BATTLE LOG ═══════
    this.logText = this.add.text(W / 2, H * 0.88, 'Press FIGHT to roll the dice!', {
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
    this.pg = pg;
    this.eg = eg;
    this._rolling = false;
    this._committed = {};
  }

  // ═══════ RESOURCE BAR ═══════

  buildResourceBar() {
    const W = this.scale.width;
    const resY = this.scale.height * 0.82;
    const defs = [
      { key: 'iceShards', label: 'ICE', color: 0x3388cc, tip: '+1 dmg' },
      { key: 'sacredFire', label: 'FIRE', color: 0xff6622, tip: '+1 dmg' },
      { key: 'healingSeeds', label: 'HEAL', color: 0x44aa44, tip: '+2 HP' },
      { key: 'surge', label: 'SURGE', color: 0xcccc22, tip: '+1 die' },
      { key: 'moonstone', label: 'MOON', color: 0xaa66ff, tip: 'die=6' },
    ];

    // Read from B.resources (the battle state), not G
    const res = B && B.resources ? B.resources : {};
    const available = defs.filter(d => (res[d.key] || 0) > 0);
    if (available.length === 0) return;

    const startX = W / 2 - (available.length * 58) / 2;
    available.forEach((r, i) => {
      const x = startX + i * 58 + 29;
      const count = res[r.key] || 0;

      const bg = this.add.rectangle(x, resY, 50, 28, r.color, 0.25)
        .setStrokeStyle(1, r.color).setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, resY, `${r.label}:${count}`, {
        fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff', align: 'center',
      }).setOrigin(0.5);

      const state = { committed: false };
      bg.on('pointerdown', () => {
        if (this._rolling || !B || !B.resources) return;
        if (!state.committed && (B.resources[r.key] || 0) > 0) {
          state.committed = true;
          // Write to B.committed so battle engine can see it
          if (!B.committed) B.committed = {};
          B.committed[r.key] = (B.committed[r.key] || 0) + 1;
          this._committed[r.key] = (this._committed[r.key] || 0) + 1;
          B.resources[r.key]--;
          bg.setFillStyle(r.color, 0.8).setStrokeStyle(2, 0xffffff);
          txt.setText(`${r.label}:\u2713`);
        } else if (state.committed) {
          state.committed = false;
          if (B.committed) B.committed[r.key] = Math.max(0, (B.committed[r.key] || 0) - 1);
          this._committed[r.key] = Math.max(0, (this._committed[r.key] || 0) - 1);
          B.resources[r.key] = (B.resources[r.key] || 0) + 1;
          bg.setFillStyle(r.color, 0.25).setStrokeStyle(1, r.color);
          txt.setText(`${r.label}:${B.resources[r.key]}`);
        }
      });

      this._resourceBtns.push({ bg, txt, state, def: r });
    });
  }

  rebuildResourceBar() {
    this._resourceBtns.forEach(b => { b.bg.destroy(); b.txt.destroy(); });
    this._resourceBtns = [];
    this.buildResourceBar();
  }

  // ═══════ COMBAT ROUND ═══════

  doRound() {
    if (!B || !this.pg || !this.eg) return;
    if (this.pg.hp <= 0 || this.eg.hp <= 0) return;
    if (this._rolling) return;
    this._rolling = true;
    this.roundNum++;
    this.fightBg.setFillStyle(0x111111);
    GameAudio.dice();

    // Read committed from B (synced by resource bar clicks)
    const committed = B && B.committed ? B.committed : this._committed;

    // Pre-roll: healing seeds (heal BEFORE dice roll, not end-of-round)
    if ((committed.healingSeeds || 0) > 0) {
      const heal = committed.healingSeeds * 2;
      this.pg.hp = Math.min(this.pg.maxHp, this.pg.hp + heal);
      this.showFloatingText(this.scale.width * 0.25, this.scale.height * 0.35, `+${heal}`, '#44dd44');
      this.updateHP();
      GameAudio.heal();
    }

    // Roll dice (surge grants extra dice, bad fortune removes one on first roll)
    const extraDice = committed.surge || 0;
    const fortuneMod = (typeof consumeFortuneBadDice === 'function') ? consumeFortuneBadDice() : 0;
    const pDiceCount = Math.max(1, 3 + extraDice + fortuneMod);
    const pDice = weightedRoll(this.pg, pDiceCount).sort((a, b) => a - b);
    const eDice = weightedRoll(this.eg, 3).sort((a, b) => a - b);

    // Moonstone: highest player die becomes 6
    if ((committed.moonstone || 0) > 0 && pDice.length > 0) {
      pDice[pDice.length - 1] = 6;
    }

    // ── Dice tumble animation ──
    const tumbles = 6;
    const tumbleMs = 60;
    for (let t = 0; t < tumbles; t++) {
      this.time.delayedCall(t * tumbleMs, () => {
        for (let i = 0; i < 3; i++) {
          if (this.playerDice[i]) this.playerDice[i].txt.setText(Phaser.Math.Between(1, 6));
          if (this.enemyDice[i]) this.enemyDice[i].txt.setText(Phaser.Math.Between(1, 6));
        }
      });
    }

    // Settle to real values after tumble
    this.time.delayedCall(tumbles * tumbleMs + 50, () => this.resolveDice(pDice, eDice));
  }

  resolveDice(pDice, eDice) {
    // Show real values with pop animation
    for (let i = 0; i < 3; i++) {
      if (this.playerDice[i]) {
        this.playerDice[i].txt.setText(pDice[i] !== undefined ? pDice[i] : '');
        this.tweens.add({ targets: [this.playerDice[i].bg, this.playerDice[i].txt], scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true });
      }
      if (this.enemyDice[i]) {
        this.enemyDice[i].txt.setText(eDice[i] !== undefined ? eDice[i] : '');
        this.tweens.add({ targets: [this.enemyDice[i].bg, this.enemyDice[i].txt], scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true, delay: 100 });
      }
    }

    const pRes = classify(pDice);
    const eRes = classify(eDice);
    const winner = compareRolls(pRes, eRes);

    let log = `R${this.roundNum}: ${pRes.type} vs ${eRes.type}`;

    // Read committed from B (synced by resource bar)
    const committed = B && B.committed ? B.committed : this._committed;

    if (winner === 'a') {
      let dmg = pRes.damage;
      // Equipment + resource damage bonus
      const wpn = G.equipped?.weapon;
      if (wpn) dmg += (wpn.bonusDamage || wpn.bonus || 0);
      dmg += (committed.iceShards || 0);
      dmg += (committed.sacredFire || 0) * 3;  // Sacred Fire = +3 dmg each

      this.eg.hp = Math.max(0, this.eg.hp - dmg);
      log += ` \u2014 ${dmg} dmg to ${this.eg.name}!`;
      this.cameras.main.shake(80, 0.004);
      this.showFloatingText(this.scale.width * 0.75, this.scale.height * 0.35, `-${dmg}`, '#cc2211');
      GameAudio.hit();
      if (dmg >= 4) this.flashScreen();
    } else if (winner === 'b') {
      let dmg = eRes.damage;
      // Equipment defense
      const arm = G.equipped?.head;
      if (arm) dmg = Math.max(1, dmg - (arm.damageReduction || arm.defense || 0));

      this.pg.hp = Math.max(0, this.pg.hp - dmg);
      log += ` \u2014 ${dmg} dmg to ${this.pg.name}!`;
      this.cameras.main.shake(120, 0.006);
      this.showFloatingText(this.scale.width * 0.25, this.scale.height * 0.35, `-${dmg}`, '#cc2211');
      GameAudio.hurt();
      if (dmg >= 4) this.flashScreen();
    } else {
      log += ' \u2014 Tie!';
    }

    this.logText.setText(log);
    this.updateHP();

    // Reset resources for next round
    this._committed = {};
    if (B) B.committed = {};
    this._rolling = false;
    this.fightBg.setFillStyle(0x222222);
    this.rebuildResourceBar();

    // Check KO — handle both player and enemy KO swap
    if (this.eg.hp <= 0) {
      this.eg.ko = true;
      // Check if enemy has living reserves (multi-ghost battles)
      const eLiving = B?.enemy?.ghosts?.filter((g, i) => i !== B.enemy.activeIdx && !g.ko && g.hp > 0) || [];
      if (eLiving.length > 0) {
        // Auto-swap enemy to next alive ghost
        const nextIdx = B.enemy.ghosts.indexOf(eLiving[0]);
        B.enemy.activeIdx = nextIdx;
        this.eg = B.enemy.ghosts[nextIdx];
        this.logText.setText(`${this.eg.name} enters the battle!`);
        this.updateHP();
      } else {
        this.time.delayedCall(600, () => this.endBattle(true));
      }
    } else if (this.pg.hp <= 0) {
      this.time.delayedCall(600, () => this.checkKOSwap());
    }
  }

  // ═══════ KO SWAP ═══════

  checkKOSwap() {
    this.pg.ko = true;
    this.pg.hp = 0;

    // Find living teammates (not the current active)
    const living = [];
    if (B?.player?.ghosts) {
      B.player.ghosts.forEach((g, i) => {
        if (!g.ko && g.hp > 0 && i !== B.player.activeIdx) {
          living.push({ ghost: g, idx: i });
        }
      });
    }

    if (living.length === 0) {
      this.endBattle(false);
      return;
    }

    this.showKOSwapPicker(living);
  }

  showKOSwapPicker(living) {
    const W = this.scale.width;
    const H = this.scale.height;
    this._swapUI = [];

    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7)
      .setDepth(600).setInteractive();
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
        .setStrokeStyle(1, 0x4466aa).setDepth(601)
        .setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setFillStyle(0x333366));
      row.on('pointerout', () => row.setFillStyle(0x222244, 0.8));
      row.on('pointerdown', () => {
        B.player.activeIdx = entry.idx;
        this.pg = B.player.ghosts[entry.idx];
        this._swapUI.forEach(o => o.destroy());
        this._swapUI = [];
        this.updateHP();
        this.logText.setText(`${this.pg.name} enters the battle!`);
        this._rolling = false;
        this._committed = {};
        this.rebuildResourceBar();
      });

      this._swapUI.push(row);
      this._swapUI.push(this.add.text(W / 2 - 130, y, g.name, {
        fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ff88',
      }).setOrigin(0, 0.5).setDepth(602));
      this._swapUI.push(this.add.text(W / 2 + 130, y, `HP ${g.hp}/${g.maxHp}`, {
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

  // White flash overlay for critical hits (damage >= 4)
  flashScreen() {
    const W = this.scale.width;
    const H = this.scale.height;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.6).setDepth(900);
    this.tweens.add({ targets: flash, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
  }

  updateHP() {
    this.playerHPText.setText(`${this.pg.name}  HP ${this.pg.hp}/${this.pg.maxHp}`);
    const pPct = this.pg.hp / this.pg.maxHp;
    this.playerHPBar.width = Math.max(0, 160 * pPct);
    this.playerHPBar.setFillStyle(pPct > 0.66 ? 0x44aa44 : pPct > 0.33 ? 0xddaa22 : 0xcc2211);
    this.playerHPText.setColor(pPct <= 0.33 ? '#cc2211' : '#222');

    this.enemyHPText.setText(`HP ${this.eg.hp}/${this.eg.maxHp}`);
    const ePct = this.eg.hp / this.eg.maxHp;
    this.enemyHPText.setColor(ePct <= 0.33 ? '#cc2211' : '#222');
    this.enemyHPBar.width = Math.max(0, 160 * ePct);
    this.enemyHPBar.setFillStyle(ePct > 0.66 ? 0x44aa44 : ePct > 0.33 ? 0xddaa22 : 0xcc2211);
  }

  // ═══════ END BATTLE ═══════

  endBattle(won) {
    const W = this.scale.width;
    const H = this.scale.height;
    let leveledUp = false;
    let xpGain = 0;
    let coinChange = 0;

    // Sync resources back from B.resources to G before clearing B
    if (B && B.resources) {
      G.iceShards = B.resources.iceShards ?? G.iceShards;
      G.sacredFire = B.resources.sacredFire ?? G.sacredFire;
      G.healingSeeds = B.resources.healingSeeds ?? G.healingSeeds;
      G.luckyStones = B.resources.luckyStones ?? G.luckyStones;
      G.surge = B.resources.surge ?? G.surge;
      G.moonstone = B.resources.moonstone ?? G.moonstone;
      G.firefly = B.resources.firefly ?? G.firefly;
    }

    if (won) {
      if (!G.rep) G.rep = { battlesWon: 0, craftsCompleted: 0, itemsSold: 0, essencesCollected: 0, raresFound: 0 };
      G.rep.battlesWon++;
      // Coin reward — variable like the 2D engine
      coinChange = 1 + Math.floor(Math.random() * 3);
      G.coins += coinChange;

      const rarityXP = { common: 1, uncommon: 2, rare: 3, 'ghost-rare': 4, legendary: 5 };
      xpGain = rarityXP[this.eg?.rarity] || 1;
      // Bonus XP for special battles
      if (this.battleData.blackRider) xpGain += 5;
      if (this.battleData.worldBoss) { xpGain += 10; coinChange += 100; }
      G.xp += xpGain;

      if (G.rep.battlesWon === 5) notify('Sideline slots unlocked!');

      const xpNeeded = G.level * 3;
      if (G.xp >= xpNeeded) {
        G.level++;
        G.xp -= xpNeeded;
        leveledUp = true;
        for (const ghost of G.team) { ghost.hp = ghost.maxHp; ghost.ko = false; }
      }

      checkAndNotifyTitles();

      // Profession XP for combat
      if (typeof addProfessionXP === 'function') {
        addProfessionXP('combat', 10);
        if (this.eg?.rarity === 'rare' || this.eg?.rarity === 'ghost-rare' || this.eg?.rarity === 'legendary') {
          addProfessionXP('combat', 5);
          addProfessionXP('exploration', 5);
        }
      }

      // Essence drops
      if (typeof generateEssence === 'function' && B?.enemyCard) {
        const zoneIdx = B.zoneIdx !== undefined ? B.zoneIdx : getCurrentZone(G.x, G.y);
        const essence = generateEssence(B.enemyCard, zoneIdx);
        if (essence) {
          if (!G.essences) G.essences = [];
          G.essences.push(essence);
        }
      }

      if (B?.isHostileNPC) markHostileNPCDefeated(B.isHostileNPC);

      // Track special battle wins
      if (this.battleData.worldBoss) {
        G.worldBossesDefeated = (G.worldBossesDefeated || 0) + 1;
      }

      // Daily challenge progress
      if (G.dailyChallenge && !G.dailyChallenge.claimed) {
        if (G.dailyChallenge.type === 'battles') G.dailyChallenge.progress++;
        if (G.dailyChallenge.type === 'trainers' && this.battleData.trainerName) G.dailyChallenge.progress++;
      }
    } else {
      // Flee penalty — match 2D engine: 2-4 coins
      const penalty = Math.min(G.coins, 2 + Math.floor(Math.random() * 3));
      if (penalty > 0) {
        G.coins -= penalty;
        coinChange = -penalty;
      }
    }

    // Sync HP back to team
    if (B?.player) {
      for (const ghost of B.player.ghosts) {
        if (ghost._teamIdx !== undefined && G.team[ghost._teamIdx]) {
          G.team[ghost._teamIdx].hp = ghost.hp;
          G.team[ghost._teamIdx].ko = ghost.ko;
        }
      }
    }

    const enemyCard = B?.enemyCard;
    const isWild = !this.battleData.trainerName;
    G.inBattle = false;
    B = null;
    saveGame();

    // ── Banner ──
    const bannerText = won ? 'VICTORY!' : 'DEFEAT';
    const bannerColor = won ? '#44dd44' : '#dd4444';
    if (won) {
      GameAudio.victory();
      if (leveledUp) this.time.delayedCall(400, () => GameAudio.levelUp());
    } else {
      GameAudio.defeat();
    }
    const banner = this.add.text(W / 2, H / 2, bannerText, {
      fontSize: '52px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: bannerColor,
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(500).setAlpha(0).setScale(0.3);

    let subtitle = '';
    if (won) {
      subtitle = `+${xpGain} XP  +${coinChange} Gold`;
      if (leveledUp) subtitle += `  LEVEL ${G.level}!`;
    } else if (coinChange < 0) {
      subtitle = `${coinChange} Gold`;
    }
    const subText = this.add.text(W / 2, H / 2 + 44, subtitle, {
      fontSize: '16px', fontFamily: 'Georgia, serif', color: won ? '#ccddcc' : '#ccaaaa',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(500).setAlpha(0);

    this.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: subText, alpha: 1, duration: 300, delay: 300 });

    this.time.delayedCall(1600, () => {
      if (won && isWild && enemyCard) {
        this.showRecruitPrompt(enemyCard, leveledUp);
      } else {
        this.transitionOut(leveledUp);
      }
    });
  }

  // ═══════ RECRUIT ═══════

  showRecruitPrompt(enemyCard, leveledUp) {
    const chance = (typeof hasSkill === 'function' && hasSkill('hunter_instinct')) ? 0.6 : 0.4;
    if (Math.random() > chance || G.team.length >= 6) {
      this.transitionOut(leveledUp);
      return;
    }

    const W = this.scale.width;
    const H = this.scale.height;

    const bg = this.add.rectangle(W / 2, H / 2 + 100, 400, 80, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4466aa).setDepth(600);
    const msg = this.add.text(W / 2, H / 2 + 85, `${enemyCard.name} wants to join your team!`, {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#88ff88',
    }).setOrigin(0.5).setDepth(601);

    const cleanup = () => { bg.destroy(); msg.destroy(); accBg.destroy(); accTxt.destroy(); decBg.destroy(); decTxt.destroy(); };

    const accBg = this.add.rectangle(W / 2 - 60, H / 2 + 115, 100, 30, 0x226622)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x44aa44).setDepth(601);
    const accTxt = this.add.text(W / 2 - 60, H / 2 + 115, 'ACCEPT', {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5).setDepth(602);
    accBg.on('pointerdown', () => {
      G.team.push({
        id: enemyCard.id, name: enemyCard.name,
        hp: enemyCard.maxHp, maxHp: enemyCard.maxHp, ko: false,
        ability: enemyCard.ability, abilityDesc: enemyCard.desc || '',
        rarity: enemyCard.rarity,
      });
      saveGame();
      cleanup();
      this.transitionOut(leveledUp);
    });

    const decBg = this.add.rectangle(W / 2 + 60, H / 2 + 115, 100, 30, 0x662222)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0xaa4444).setDepth(601);
    const decTxt = this.add.text(W / 2 + 60, H / 2 + 115, 'DECLINE', {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5).setDepth(602);
    decBg.on('pointerdown', () => { cleanup(); this.transitionOut(leveledUp); });
  }

  transitionOut(leveledUp) {
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
}
