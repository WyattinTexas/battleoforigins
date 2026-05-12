// ═══════════════════════════════════════════════════
// PANEL MANAGER — Reusable panel/overlay system for Phaser
// Opens centered panels with title bar, close button, content area.
// Only one panel at a time. ESC or backdrop click to close.
// ═══════════════════════════════════════════════════

class PanelManager {
  constructor(scene) {
    this.scene = scene;
    this._open = false;
    this._objects = []; // all Phaser objects for cleanup
    this._escKey = null;
    this._contentContainer = null;
  }

  /**
   * Open a panel.
   * @param {string} title - Panel title
   * @param {function} contentBuilder - function(container, panelW, panelH) that adds Phaser objects
   * @param {object} opts - { width, height, onClose }
   * @returns {Phaser.GameObjects.Container} the content container
   */
  open(title, contentBuilder, opts = {}) {
    // Close any existing panel first
    if (this._open) this.close();

    const scene = this.scene;
    const { width: screenW, height: screenH } = scene.scale;
    const panelW = opts.width || Math.min(600, screenW * 0.8);
    const panelH = opts.height || Math.min(500, screenH * 0.8);
    const panelX = (screenW - panelW) / 2;
    const panelY = (screenH - panelH) / 2;
    const titleBarH = 36;

    this._onClose = opts.onClose || null;
    this._open = true;
    this._objects = [];

    // ── Backdrop (semi-transparent, click to close) ──
    const backdrop = scene.add.rectangle(screenW / 2, screenH / 2, screenW, screenH, 0x000000, 0.6)
      .setInteractive({ useHandCursor: false })
      .setDepth(900);
    backdrop.on('pointerdown', () => this.close());
    this._objects.push(backdrop);

    // ── Panel background ──
    const panelBg = scene.add.rectangle(screenW / 2, screenH / 2, panelW, panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x334466)
      .setDepth(901)
      .setInteractive(); // absorb clicks so they don't pass to backdrop
    this._objects.push(panelBg);

    // ── Title bar background ──
    const titleBg = scene.add.rectangle(screenW / 2, panelY + titleBarH / 2, panelW, titleBarH, 0x0a0a1a, 0.9)
      .setDepth(902);
    this._objects.push(titleBg);

    // ── Title text ──
    const titleText = scene.add.text(panelX + 14, panelY + titleBarH / 2, title, {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ccccdd',
    }).setOrigin(0, 0.5).setDepth(903);
    this._objects.push(titleText);

    // ── Close button (X) ──
    const closeBtnBg = scene.add.rectangle(panelX + panelW - 20, panelY + titleBarH / 2, 28, 24, 0x442222, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(903);
    const closeBtnText = scene.add.text(panelX + panelW - 20, panelY + titleBarH / 2, 'X', {
      fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff6666',
    }).setOrigin(0.5).setDepth(904);

    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0x662222));
    closeBtnBg.on('pointerout', () => closeBtnBg.setFillStyle(0x442222, 0.8));
    closeBtnBg.on('pointerdown', () => this.close());
    this._objects.push(closeBtnBg, closeBtnText);

    // ── Divider line under title ──
    const divider = scene.add.rectangle(screenW / 2, panelY + titleBarH, panelW - 4, 1, 0x334466)
      .setDepth(902);
    this._objects.push(divider);

    // ── Content container ──
    // The content container is positioned so (0,0) is the top-left of the content area
    const contentX = panelX;
    const contentY = panelY + titleBarH + 2;
    const contentW = panelW;
    const contentH = panelH - titleBarH - 2;

    const container = scene.add.container(contentX, contentY).setDepth(905);
    this._contentContainer = container;
    this._objects.push(container);

    // ── ESC key binding ──
    if (scene.input.keyboard) {
      this._escKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this._escKey.on('down', () => this.close());
    }

    // Pin all objects to camera (don't scroll with world)
    for (const obj of this._objects) {
      if (obj.setScrollFactor) obj.setScrollFactor(0);
    }

    // ── Call content builder ──
    if (contentBuilder) {
      contentBuilder(container, contentW, contentH);
    }

    return container;
  }

  /**
   * Close the current panel.
   */
  close() {
    if (!this._open) return;
    this._open = false;

    // Destroy all panel objects
    for (const obj of this._objects) {
      if (obj && obj.destroy) obj.destroy();
    }
    this._objects = [];
    this._contentContainer = null;

    // Remove ESC key listener
    if (this._escKey) {
      this._escKey.removeAllListeners();
      this._escKey = null;
    }

    // Call onClose callback
    if (this._onClose) {
      this._onClose();
      this._onClose = null;
    }
  }

  /**
   * Check if a panel is currently open.
   * @returns {boolean}
   */
  isOpen() {
    return this._open;
  }

  /**
   * Get the content container (for adding objects after open).
   * @returns {Phaser.GameObjects.Container|null}
   */
  getContentContainer() {
    return this._contentContainer;
  }
}
