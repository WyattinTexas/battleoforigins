// ═══════════════════════════════════════════════════
// COMM OVERLAY — Star Fox-style dialogue with portraits
// Renders as Phaser UI on top of the WorldScene
// ═══════════════════════════════════════════════════

class CommOverlay {
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.isActive = false;
    this.queue = [];
    this.typing = false;
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
    if (this.container) return; // Already built

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    // Background box — bottom of screen, compact Star Fox style
    const boxY = H - 90;
    const boxW = Math.min(W - 40, 700);
    const boxX = W / 2;

    // Dark panel with border
    const bg = this.scene.add.rectangle(boxX, boxY, boxW, 80, 0x0a0a1e, 0.92)
      .setStrokeStyle(2, 0x4444aa);

    // Portrait placeholder (left side)
    const portraitBg = this.scene.add.rectangle(boxX - boxW/2 + 40, boxY, 56, 56, 0x222244)
      .setStrokeStyle(1, 0x6666aa);

    // Portrait letter
    this.portraitText = this.scene.add.text(boxX - boxW/2 + 40, boxY, '', {
      fontSize: '28px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);

    // Name text
    this.nameText = this.scene.add.text(boxX - boxW/2 + 80, boxY - 22, '', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
    }).setOrigin(0, 0.5);

    // Dialogue text
    this.dialogueText = this.scene.add.text(boxX - boxW/2 + 80, boxY + 4, '', {
      fontSize: '13px', fontFamily: 'Georgia, serif', color: '#ccccee',
      wordWrap: { width: boxW - 120 },
    }).setOrigin(0, 0.5);

    // Dismiss hint
    this.dismissText = this.scene.add.text(boxX + boxW/2 - 12, boxY + 28, '[ E ]', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'italic', color: '#666688',
    }).setOrigin(1, 0.5);

    this.container.add([bg, portraitBg, this.portraitText, this.nameText, this.dialogueText, this.dismissText]);
  }

  displayMessage(name, text, opts) {
    if (!this.container) return;

    this.nameText.setText(name);
    this.portraitText.setText(name.charAt(0).toUpperCase());

    // Color the name based on NPC type
    const color = opts.color || '#ffdd44';
    this.nameText.setColor(color);

    // Typewriter effect
    this.typing = true;
    let charIdx = 0;
    this.dialogueText.setText('');

    if (this._typeTimer) this._typeTimer.remove();
    this._typeTimer = this.scene.time.addEvent({
      delay: 25,
      repeat: text.length - 1,
      callback: () => {
        charIdx++;
        this.dialogueText.setText(text.substring(0, charIdx));
        if (charIdx >= text.length) this.typing = false;
      }
    });

    // Auto-dismiss after duration or E key
    const duration = opts.duration || Math.max(3000, text.length * 40 + 1500);
    if (this._dismissTimer) this._dismissTimer.remove();
    this._dismissTimer = this.scene.time.delayedCall(duration, () => this.processNext());
  }

  dismiss() {
    if (this.typing) {
      // Skip typing — show full text
      if (this._typeTimer) this._typeTimer.remove();
      this.typing = false;
      return;
    }
    if (this._dismissTimer) this._dismissTimer.remove();
    this.processNext();
  }

  hide() {
    this.isActive = false;
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    if (this._typeTimer) this._typeTimer.remove();
    if (this._dismissTimer) this._dismissTimer.remove();
  }
}
