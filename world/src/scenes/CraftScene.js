// ═══════════════════════════════════════════════════
// CRAFT SCENE — Wave 2: Full crafting pipeline
// Schematic picker → Essence selection → Assembly → Result
// ═══════════════════════════════════════════════════

class CraftScene extends Phaser.Scene {
  constructor() { super('CraftScene'); }

  init(data) { this._returnScene = data?.returnScene || 'WorldScene'; }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();

    const pw = 620, ph = 440;
    this._px = W / 2 - pw / 2;
    this._py = W > 0 ? H / 2 - ph / 2 : 50;
    this._pw = pw;
    this._ph = ph;

    this.add.rectangle(W / 2, H / 2, pw + 4, ph + 4, 0x444444);
    this.add.rectangle(W / 2, H / 2, pw, ph, 0x1a1a2e);

    this.add.text(W / 2, this._py + 22, 'CRAFTING WORKBENCH', {
      fontSize: '20px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
    }).setOrigin(0.5);

    // Close button
    const cBtn = this.add.rectangle(this._px + pw - 20, this._py + 20, 28, 28, 0x662222)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0xaa4444);
    this.add.text(this._px + pw - 20, this._py + 20, 'X', {
      fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff6666',
    }).setOrigin(0.5);
    cBtn.on('pointerdown', () => this.closeCraft());
    this.input.keyboard.on('keydown-ESC', () => this.closeCraft());

    this._dyn = [];
    this._selSchem = null;
    this._selEss = [];

    this.showSchematicPicker();
  }

  clearDyn() {
    this._dyn.forEach(o => o.destroy());
    this._dyn = [];
  }

  // ═══════ STEP 1: SCHEMATIC PICKER ═══════

  showSchematicPicker() {
    this.clearDyn();
    const x = this._px + 20;
    let y = this._py + 52;

    this._dyn.push(this.add.text(x, y, 'Choose a Schematic:', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ccc',
    }));
    y += 26;

    if (typeof SCHEMATICS === 'undefined' || !SCHEMATICS.length) {
      this._dyn.push(this.add.text(x, y, 'No schematics available.', {
        fontSize: '12px', fontFamily: 'monospace', color: '#888',
      }));
      return;
    }

    const tierCol = { common: '#aaa', rare: '#5599ff', legendary: '#ffaa22' };
    const cx = this._px + this._pw / 2;

    SCHEMATICS.slice(0, 8).forEach((s, i) => {
      const sy = y + i * 40;
      const need = s.essencesNeeded || 2;
      const ok = (G.essences?.length || 0) >= need;

      const row = this.add.rectangle(cx, sy + 13, this._pw - 36, 34, ok ? 0x222244 : 0x1a1a1a, 0.6)
        .setStrokeStyle(1, ok ? 0x334466 : 0x222222);
      if (ok) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setFillStyle(0x333366));
        row.on('pointerout', () => row.setFillStyle(0x222244, 0.6));
        row.on('pointerdown', () => { this._selSchem = s; this._selEss = []; this.showEssencePicker(); });
      }
      this._dyn.push(row);

      this._dyn.push(this.add.text(x + 6, sy + 2, s.icon || '?', { fontSize: '16px' }));
      this._dyn.push(this.add.text(x + 30, sy, s.name, {
        fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: tierCol[s.tier] || '#ccc',
      }));
      this._dyn.push(this.add.text(x + 30, sy + 16, `${s.desc} \u2014 ${need} essences \u2014 ${s.slot}`, {
        fontSize: '9px', fontFamily: 'monospace', color: ok ? '#777' : '#443333',
      }));
    });
  }

  // ═══════ STEP 2: ESSENCE PICKER ═══════

  showEssencePicker() {
    this.clearDyn();
    const s = this._selSchem;
    const x = this._px + 20;
    let y = this._py + 52;

    this._dyn.push(this.add.text(x, y, `Select ${s.essencesNeeded} essences for ${s.icon} ${s.name}:`, {
      fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ccc',
    }));
    this._dyn.push(this.add.text(this._px + this._pw - 30, y, `${this._selEss.length}/${s.essencesNeeded}`, {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffdd44',
    }).setOrigin(1, 0));
    y += 24;

    const rCol = { common: '#aaa', uncommon: '#5599ff', rare: '#aa55ff', 'ghost-rare': '#ff55aa', legendary: '#ffaa22' };
    const essences = G.essences || [];
    const cx = this._px + this._pw / 2;

    essences.slice(0, 8).forEach((e, i) => {
      const ey = y + i * 32;
      const sel = this._selEss.includes(i);

      const row = this.add.rectangle(cx, ey + 9, this._pw - 36, 26, sel ? 0x224422 : 0x222233, 0.6)
        .setStrokeStyle(1, sel ? 0x44aa44 : 0x333344)
        .setInteractive({ useHandCursor: true });
      row.on('pointerdown', () => {
        const idx = this._selEss.indexOf(i);
        if (idx >= 0) this._selEss.splice(idx, 1);
        else if (this._selEss.length < s.essencesNeeded) this._selEss.push(i);
        this.showEssencePicker();
      });
      this._dyn.push(row);

      this._dyn.push(this.add.text(x + 8, ey + 1, `${sel ? '\u2713 ' : '  '}${e.fromName || e.name}`, {
        fontSize: '12px', fontFamily: 'monospace', color: rCol[e.rarity] || '#ccc',
      }));
      this._dyn.push(this.add.text(this._px + this._pw - 30, ey + 1, `P:${e.potency} S:${e.stability} R:${e.resonance}`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#777',
      }).setOrigin(1, 0));
    });

    // Craft button
    if (this._selEss.length >= s.essencesNeeded) {
      const by = y + Math.min(essences.length, 8) * 32 + 16;
      const btn = this.add.rectangle(cx, by, 180, 36, 0x226622)
        .setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true });
      this._dyn.push(btn);
      this._dyn.push(this.add.text(cx, by, 'CRAFT!', {
        fontSize: '17px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#fff',
      }).setOrigin(0.5));
      btn.on('pointerover', () => btn.setFillStyle(0x338833));
      btn.on('pointerout', () => btn.setFillStyle(0x226622));
      btn.on('pointerdown', () => this.doAssembly());
    }

    // Back button
    const back = this.add.rectangle(this._px + 55, this._py + this._ph - 28, 80, 24, 0x333333)
      .setStrokeStyle(1, 0x555555).setInteractive({ useHandCursor: true });
    this._dyn.push(back);
    this._dyn.push(this.add.text(this._px + 55, this._py + this._ph - 28, '< Back', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5));
    back.on('pointerdown', () => { this._selSchem = null; this._selEss = []; this.showSchematicPicker(); });
  }

  // ═══════ STEP 3: ASSEMBLY + RESULT ═══════

  doAssembly() {
    this.clearDyn();
    const s = this._selSchem;
    const essences = this._selEss.map(i => G.essences[i]);
    const cx = this._px + this._pw / 2;
    let y = this._py + 75;

    // Mastery — look up XP for this schematic's type (weapon/armor/accessory)
    const masteryLvl = (typeof getMasteryLevel === 'function') ? getMasteryLevel(G.mastery?.[s.type]?.xp || 0) : 1;

    // Assembly roll
    const roll = Math.floor(Math.random() * 100) + 1 + (masteryLvl * 5);
    let assemblyMod = 0, assemblyLabel = '';
    if (roll > 80) { assemblyMod = 0.15; assemblyLabel = 'EXCELLENT'; }
    else if (roll > 50) { assemblyMod = 0; assemblyLabel = 'GOOD'; }
    else if (roll > 20) { assemblyMod = -0.10; assemblyLabel = 'ROUGH'; }
    else if (roll > 1) { assemblyMod = -0.25; assemblyLabel = 'POOR'; }
    else { assemblyMod = -9999; assemblyLabel = 'CATASTROPHE'; }

    // Quality from essence stats
    const w = s.weights || { potency: 0.25, stability: 0.25, resonance: 0.25, purity: 0.25 };
    let aP = 0, aS = 0, aR = 0, aPu = 0;
    essences.forEach(e => { aP += e.potency; aS += e.stability; aR += e.resonance; aPu += (e.purity || 0); });
    aP /= essences.length; aS /= essences.length; aR /= essences.length; aPu /= essences.length;

    const weighted = Math.floor(aP * w.potency + aS * w.stability + aR * w.resonance + aPu * (w.purity || 0));
    const base = Math.max(masteryLvl * 50, weighted);
    const quality = assemblyMod === -9999 ? 0 : Math.max(0, Math.floor(base * (1 + assemblyMod)));

    let tier = 'Basic';
    if (quality > 600) tier = 'Mastercraft';
    else if (quality > 400) tier = 'Superior';
    else if (quality > 200) tier = 'Standard';

    const tierCol = { Basic: '#aaa', Standard: '#55aaff', Superior: '#aa55ff', Mastercraft: '#ffaa22' };
    const rollCol = assemblyMod >= 0.15 ? '#44dd44' : assemblyMod >= 0 ? '#88ff88' : assemblyMod > -9999 ? '#ff8844' : '#ff2222';

    // Animate: assembling...
    this._dyn.push(this.add.text(cx, y, 'Assembling...', {
      fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
    }).setOrigin(0.5));

    // Show roll
    this.time.delayedCall(600, () => {
      this._dyn.push(this.add.text(cx, y + 40, `Assembly Roll: ${Math.min(roll, 100)} \u2014 ${assemblyLabel}`, {
        fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold', color: rollCol,
      }).setOrigin(0.5));
    });

    // Show result
    this.time.delayedCall(1400, () => {
      // Remove used essences (reverse order)
      const toRemove = [...this._selEss].sort((a, b) => b - a);
      toRemove.forEach(i => G.essences.splice(i, 1));

      if (assemblyMod === -9999) {
        this._dyn.push(this.add.text(cx, y + 90, 'The essences shattered!\nItem destroyed.', {
          fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ff4444', align: 'center',
        }).setOrigin(0.5));
        saveGame();
        return;
      }

      // Create item
      const bonusDmg = s.type === 'weapon' ? Math.floor(quality / 300) + 1 : 0;
      const dmgRed = (s.type === 'armor' || s.slot === 'head') ? Math.floor(quality / 400) + 1 : 0;

      const item = {
        id: Date.now(), name: `${tier} ${s.name}`,
        schematic: s.id, type: s.type, slot: s.slot, icon: s.icon, tier: s.tier,
        quality, qualityTier: tier, desc: s.desc,
        bonusDamage: bonusDmg, bonus: bonusDmg,
        damageReduction: dmgRed, defense: dmgRed,
        craftedBy: G.name, craftedAt: Date.now(),
        stats: { potency: Math.floor(aP), stability: Math.floor(aS), resonance: Math.floor(aR), purity: Math.floor(aPu) },
      };

      if (!G.gear) G.gear = [];
      G.gear.push(item);
      if (!G.mastery) G.mastery = {};
      if (!G.mastery[s.type]) G.mastery[s.type] = { xp: 0 };
      G.mastery[s.type].xp += 1;
      if (!G.rep) G.rep = {};
      G.rep.craftsCompleted = (G.rep.craftsCompleted || 0) + 1;
      if (typeof addProfessionXP === 'function') addProfessionXP('crafting', 10);
      saveGame();

      // Result display
      const title = this.add.text(cx, y + 80, `${s.icon} ${item.name}`, {
        fontSize: '20px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: tierCol[tier],
      }).setOrigin(0.5).setAlpha(0).setScale(0.5);
      this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 400, ease: 'Back.easeOut' });
      this._dyn.push(title);

      this._dyn.push(this.add.text(cx, y + 108, `Quality: ${quality} \u2014 ${tier}`, {
        fontSize: '14px', fontFamily: 'monospace', color: tierCol[tier],
      }).setOrigin(0.5));

      let statLine = s.desc;
      if (bonusDmg > 0) statLine += ` | +${bonusDmg} dmg`;
      if (dmgRed > 0) statLine += ` | -${dmgRed} dmg taken`;
      this._dyn.push(this.add.text(cx, y + 130, statLine, {
        fontSize: '11px', fontFamily: 'monospace', color: '#888',
      }).setOrigin(0.5));

      // Equip now button
      const eqBg = this.add.rectangle(cx, y + 170, 160, 34, 0x224422)
        .setStrokeStyle(1, 0x44aa44).setInteractive({ useHandCursor: true });
      const eqTxt = this.add.text(cx, y + 170, 'EQUIP NOW', {
        fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ff88',
      }).setOrigin(0.5);
      eqBg.on('pointerdown', () => {
        const sl = item.slot;
        if (G.equipped[sl]) G.gear.push(G.equipped[sl]);
        G.equipped[sl] = item;
        G.gear.splice(G.gear.indexOf(item), 1);
        saveGame();
        eqTxt.setText('EQUIPPED!');
        eqBg.disableInteractive().setFillStyle(0x113311);
      });
      this._dyn.push(eqBg, eqTxt);

      // Craft another button
      const anBg = this.add.rectangle(cx, y + 210, 160, 28, 0x333333)
        .setStrokeStyle(1, 0x555555).setInteractive({ useHandCursor: true });
      this._dyn.push(anBg);
      this._dyn.push(this.add.text(cx, y + 210, 'Craft Another', {
        fontSize: '11px', fontFamily: 'monospace', color: '#aaa',
      }).setOrigin(0.5));
      anBg.on('pointerdown', () => { this._selSchem = null; this._selEss = []; this.showSchematicPicker(); });
    });
  }

  closeCraft() {
    this.scene.stop();
    this.scene.resume(this._returnScene || 'WorldScene');
  }
}
