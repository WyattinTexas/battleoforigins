// ═══════════════════════════════════════════════════
// COMM OVERLAY — Star Fox-style dialogue with portraits
// Renders as Phaser UI on top of the WorldScene
// Uses NPC_COMM_PORTRAITS from spirit-comms.js for art
// ═══════════════════════════════════════════════════

class CommOverlay {
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.isActive = false;
    this.queue = [];
    this.typing = false;
    this._portraitCache = {};
  }

  show(name, text, opts = {}) {
    this.queue.push({ name, text, opts });
    if (!this.isActive) this.processNext();
  }

  processNext() {
    if (this.queue.length === 0) {
      this.hide();
      return;
    }
    const msg = this.queue.shift();
    this.isActive = true;
    this.build();
    this.displayMessage(msg.name, msg.text, msg.opts);
  }

  build() {
    if (this.container) return;

    // Use the raw canvas dimensions. The container will be set
    // scrollFactor(0) below so its children are screen-space-locked;
    // positions must be in canvas pixels, NOT divided by zoom (the
    // old divide-by-zoom logic offset the dialog to the left half of
    // the screen at high zoom levels — visible in DungeonScene at 1.6x).
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    // Layout — keep box centered and compact, well within visible area
    const boxY = H - 70;
    const boxW = Math.min(W * 0.75, 600);
    const boxX = W / 2;
    this._boxX = boxX;
    this._boxY = boxY;
    this._boxW = boxW;

    // Dark panel
    const bg = this.scene.add.rectangle(boxX, boxY, boxW, 80, 0x080c20, 0.94)
      .setStrokeStyle(3, 0x888899);

    // Portrait area — properly inset so it's not clipped
    const portraitX = boxX - boxW / 2 + 50;
    const portraitBg = this.scene.add.rectangle(portraitX, boxY, 64, 64, 0x1a1a3e)
      .setStrokeStyle(2, 0x6666aa);

    this.portraitImage = null;
    this.portraitX = portraitX;

    // Portrait letter fallback
    this.portraitText = this.scene.add.text(portraitX, boxY, '', {
      fontSize: '28px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);

    // Scanlines over portrait
    this._scanlines = [];
    for (let sy = boxY - 30; sy < boxY + 30; sy += 3) {
      const line = this.scene.add.rectangle(portraitX, sy, 64, 1, 0x000000, 0.12);
      this._scanlines.push(line);
    }

    // Name
    this.nameText = this.scene.add.text(boxX - boxW / 2 + 96, boxY - 24, '', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
      shadow: { offsetX: 0, offsetY: 0, color: '#ffdd44', blur: 8, fill: true },
    }).setOrigin(0, 0.5);

    // Dialogue
    this.dialogueText = this.scene.add.text(boxX - boxW / 2 + 96, boxY + 2, '', {
      fontSize: '13px', fontFamily: 'Georgia, serif', color: '#ccccee',
      wordWrap: { width: boxW - 140 },
    }).setOrigin(0, 0.5);

    // Blinking cursor
    this.cursor = this.scene.add.text(0, 0, '▌', {
      fontSize: '13px', fontFamily: 'monospace', color: '#88aaff',
    }).setOrigin(0, 0.5).setAlpha(0);
    this.scene.tweens.add({
      targets: this.cursor, alpha: { from: 0, to: 1 },
      duration: 500, yoyo: true, repeat: -1,
    });

    // Dismiss hint
    this.dismissText = this.scene.add.text(boxX + boxW / 2 - 14, boxY + 28, '[ E or click ]', {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'italic', color: '#556688',
    }).setOrigin(1, 0.5);
    this.scene.tweens.add({
      targets: this.dismissText, alpha: { from: 0.4, to: 1 },
      duration: 1500, yoyo: true, repeat: -1,
    });

    // Click to dismiss
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.dismiss());

    // E key to dismiss — listen on the scene's keyboard
    if (!this._eKeyBound) {
      this._eKeyBound = true;
      this.scene.input.keyboard.on('keydown-E', () => {
        if (this.isActive) this.dismiss();
      });
      // Also click anywhere on canvas
      this.scene.input.on('pointerdown', () => {
        if (this.isActive) this.dismiss();
      });
    }

    this.container.add([bg, portraitBg, this.portraitText, ...this._scanlines,
      this.nameText, this.dialogueText, this.cursor, this.dismissText]);
  }

  displayMessage(name, text, opts) {
    if (!this.container) return;

    this.nameText.setText(name);

    // Color
    const npcData = (typeof NPC_COMM_PORTRAITS !== 'undefined') ? NPC_COMM_PORTRAITS[name] : null;
    const color = opts.color || (npcData ? npcData.color : '#ffdd44');
    this.nameText.setColor(color);
    this.nameText.setShadow(0, 0, color, 8, true, true);

    // Portrait
    this._loadPortrait(name, npcData);

    // SFX
    if (typeof commPlayBlip === 'function') commPlayBlip();

    // Typewriter
    this.typing = true;
    let charIdx = 0;
    this.dialogueText.setText('');
    this.cursor.setAlpha(1);

    if (this._typeTimer) this._typeTimer.remove();
    this._typeTimer = this.scene.time.addEvent({
      delay: 25,
      repeat: text.length - 1,
      callback: () => {
        charIdx++;
        this.dialogueText.setText(text.substring(0, charIdx));
        if (charIdx % 2 === 0 && typeof commPlayTypeBlip === 'function') commPlayTypeBlip();
        const bounds = this.dialogueText.getBounds();
        this.cursor.setPosition(bounds.right + 2, bounds.y + bounds.height / 2);
        if (charIdx >= text.length) {
          this.typing = false;
          this.cursor.setAlpha(0);
        }
      }
    });

    // Auto-dismiss
    const duration = opts.duration || Math.max(3000, text.length * 40 + 1500);
    if (this._dismissTimer) this._dismissTimer.remove();
    this._dismissTimer = this.scene.time.delayedCall(duration, () => this.processNext());
  }

  _loadPortrait(name, npcData) {
    if (this.portraitImage) {
      this.portraitImage.destroy();
      this.portraitImage = null;
    }

    if (!npcData || !npcData.art) {
      this.portraitText.setText(name.charAt(0).toUpperCase()).setAlpha(1);
      return;
    }

    const texKey = 'comm_' + name.replace(/[^a-zA-Z0-9]/g, '_');

    if (this.scene.textures.exists(texKey)) {
      this.portraitText.setAlpha(0);
      this.portraitImage = this.scene.add.image(this.portraitX, this._boxY, texKey)
        .setDisplaySize(58, 58).setDepth(501);
      this.container.add(this.portraitImage);
    } else if (!this._portraitCache[texKey]) {
      this._portraitCache[texKey] = true;
      this.portraitText.setText(name.charAt(0).toUpperCase()).setAlpha(1);

      this.scene.load.image(texKey, npcData.art);
      this.scene.load.once('complete', () => {
        if (!this.container || !this.isActive) return;
        this.portraitText.setAlpha(0);
        this.portraitImage = this.scene.add.image(this.portraitX, this._boxY, texKey)
          .setDisplaySize(58, 58).setDepth(501);
        this.container.add(this.portraitImage);
      });
      this.scene.load.start();
    } else {
      this.portraitText.setText(name.charAt(0).toUpperCase()).setAlpha(1);
    }
  }

  dismiss() {
    if (this.typing) {
      // First press: skip typewriter — show full text immediately
      if (this._typeTimer) this._typeTimer.remove();
      this.typing = false;
      this.cursor.setAlpha(0);
      return;
    }
    // Second press: clear everything including queue
    if (this._dismissTimer) this._dismissTimer.remove();
    this.queue = []; // Clear queue so it doesn't keep coming back
    this.hide();
  }

  // Force-dismiss without clearing queue (for internal processNext flow)
  _advance() {
    if (this.typing) {
      if (this._typeTimer) this._typeTimer.remove();
      this.typing = false;
      this.cursor.setAlpha(0);
      return;
    }
    if (this._dismissTimer) this._dismissTimer.remove();
    this.processNext();
  }

  showChoice(name, prompt, choices) {
    this.queue = [];
    this.show(name, prompt, { duration: 999999, color: '#88ff88' });

    const checkTyping = this.scene.time.addEvent({
      delay: 100, repeat: 100,
      callback: () => {
        if (this.typing) return;
        checkTyping.remove();
        this._buildChoiceButtons(choices);
      }
    });
  }

  _buildChoiceButtons(choices) {
    if (!this.container) return;

    const zoom = this.scene.cameras?.main?.zoom || 1;
    const W = this.scene.scale.width / zoom;
    const H = this.scene.scale.height / zoom;
    const boxY = H - 90;
    const startY = boxY + 52;

    this._choiceElements = [];

    choices.forEach((choice, i) => {
      const btnY = startY + i * 38;
      const btnW = Math.min(W - 80, 500);

      const bg = this.scene.add.rectangle(W / 2, btnY, btnW, 32, 0x1a1a3e, 0.95)
        .setStrokeStyle(2, 0x5566cc)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0).setDepth(510);

      const label = this.scene.add.text(W / 2, btnY, choice.label, {
        fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ccddff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(511);

      bg.on('pointerover', () => { bg.setFillStyle(0x2a2a5e, 1); label.setColor('#ffffff'); });
      bg.on('pointerout', () => { bg.setFillStyle(0x1a1a3e, 0.95); label.setColor('#ccddff'); });
      bg.on('pointerdown', () => {
        this._clearChoiceButtons();
        if (this._dismissTimer) this._dismissTimer.remove();
        this.queue = [];
        this.hide();
        if (choice.callback) choice.callback();
      });

      this._choiceElements.push(bg, label);
    });
  }

  _clearChoiceButtons() {
    if (this._choiceElements) {
      this._choiceElements.forEach(el => el.destroy());
      this._choiceElements = null;
    }
  }

  hide() {
    this.isActive = false;
    this._clearChoiceButtons();
    if (this.portraitImage) { this.portraitImage.destroy(); this.portraitImage = null; }
    if (this.container) { this.container.destroy(); this.container = null; }
    if (this._typeTimer) this._typeTimer.remove();
    if (this._dismissTimer) this._dismissTimer.remove();
  }
}
