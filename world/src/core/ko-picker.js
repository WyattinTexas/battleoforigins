/* ═══════════════════════════════════════════════════
   KO PICKER — Battle of Origins World
   DOM-based replacement picker when a Spiritkin falls.

   Usage:
     KOPicker.show(livingGhosts, callback)
     // livingGhosts = array of { id, name, hp, maxHp, art, ability, abilityDesc, rarity }
     // callback(chosenGhost) called when player picks

   Container: position:fixed; inset:0; z-index:10500
   Self-injecting CSS (style tag on first use).
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RARITY_COLORS = {
    common:       '#94a3b8',
    uncommon:     '#4ade80',
    rare:         '#5fb8e8',
    'ghost-rare': '#67e8f9',
    legendary:    '#f39c12',
  };

  const GOLD = '#d4a040';
  const GOLD_GLOW = '#f5d77a';

  // ── CSS injection ──
  let cssInjected = false;
  function ensureCSS() {
    if (cssInjected) return;
    cssInjected = true;

    const style = document.createElement('style');
    style.id = 'koPickerCSS';
    style.textContent = `
      /* ── KO Picker Overlay ── */
      .ko-picker-overlay {
        position: fixed;
        inset: 0;
        z-index: 10500;
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.82);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        animation: koFadeIn 0.4s ease-out;
        font-family: 'Cormorant Garamond', Georgia, serif;
      }

      @keyframes koFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      @keyframes koFadeOut {
        from { opacity: 1; }
        to   { opacity: 0; }
      }

      @keyframes koSlideUp {
        from { transform: translateY(30px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }

      @keyframes koPulseSelect {
        0%   { transform: scale(1); box-shadow: 0 0 20px ${GOLD}; }
        50%  { transform: scale(1.06); box-shadow: 0 0 40px ${GOLD_GLOW}; }
        100% { transform: scale(1); box-shadow: 0 0 20px ${GOLD}; }
      }

      .ko-picker-header {
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        color: #ff5544;
        text-transform: uppercase;
        letter-spacing: 2px;
        text-shadow: 0 0 12px rgba(255, 60, 40, 0.6), 0 2px 4px rgba(0,0,0,0.8);
        margin-bottom: 4px;
        animation: koSlideUp 0.5s ease-out;
      }

      .ko-picker-subheader {
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-size: 18px;
        color: #bbb;
        margin-bottom: 24px;
        animation: koSlideUp 0.6s ease-out;
      }

      .ko-picker-cards {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 90vw;
        padding: 0 16px;
      }

      .ko-picker-card {
        width: 180px;
        background: linear-gradient(165deg, #1a1a2e 0%, #0f0f1a 100%);
        border: 2px solid var(--ko-rarity-color, #94a3b8);
        border-radius: 10px;
        cursor: pointer;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        animation: koSlideUp 0.5s ease-out backwards;
        position: relative;
      }

      .ko-picker-card:hover {
        transform: translateY(-10px) scale(1.03);
        border-color: ${GOLD} !important;
        box-shadow:
          0 0 18px ${GOLD}88,
          0 8px 30px rgba(0, 0, 0, 0.6),
          inset 0 0 8px ${GOLD}22;
      }

      .ko-picker-card.ko-selected {
        animation: koPulseSelect 0.35s ease-in-out;
        border-color: ${GOLD} !important;
        box-shadow: 0 0 30px ${GOLD};
      }

      .ko-picker-card-art {
        width: 100%;
        height: 140px;
        object-fit: cover;
        display: block;
        background: #111;
      }

      .ko-picker-card-body {
        padding: 10px 12px 12px;
      }

      .ko-picker-card-name {
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        color: #fff;
        margin-bottom: 8px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.7);
        line-height: 1.4;
      }

      /* HP Bar */
      .ko-picker-hp-track {
        width: 100%;
        height: 10px;
        background: #1a1a1a;
        border-radius: 5px;
        overflow: hidden;
        border: 1px solid #333;
        margin-bottom: 8px;
        position: relative;
      }

      .ko-picker-hp-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
        background: linear-gradient(90deg, #44aa44, #66cc66);
      }

      .ko-picker-hp-fill.hp-mid {
        background: linear-gradient(90deg, #ddaa22, #eebb44);
      }

      .ko-picker-hp-fill.hp-low {
        background: linear-gradient(90deg, #cc2211, #ee4433);
      }

      .ko-picker-hp-text {
        font-size: 11px;
        color: #aaa;
        margin-bottom: 6px;
        font-family: 'Cormorant Garamond', Georgia, serif;
      }

      .ko-picker-ability-name {
        font-size: 13px;
        font-weight: 700;
        color: ${GOLD};
        margin-bottom: 3px;
      }

      .ko-picker-ability-desc {
        font-size: 12px;
        color: #999;
        line-height: 1.35;
      }

      /* Rarity shimmer line at top of card */
      .ko-picker-rarity-bar {
        height: 3px;
        background: var(--ko-rarity-color, #94a3b8);
        box-shadow: 0 0 6px var(--ko-rarity-color, #94a3b8);
      }

      /* Mobile: stack vertically, smaller cards */
      @media (max-width: 600px) {
        .ko-picker-header { font-size: 11px; }
        .ko-picker-cards { flex-direction: column; align-items: center; }
        .ko-picker-card { width: 260px; }
        .ko-picker-card-art { height: 120px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build and show the picker ──
  function show(livingGhosts, callback) {
    ensureCSS();

    // Remove any existing picker
    const existing = document.getElementById('koPickerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'koPickerOverlay';
    overlay.className = 'ko-picker-overlay';

    // Header
    const header = document.createElement('div');
    header.className = 'ko-picker-header';
    header.textContent = 'YOUR SPIRITKIN HAS FALLEN';
    overlay.appendChild(header);

    const sub = document.createElement('div');
    sub.className = 'ko-picker-subheader';
    sub.textContent = 'Choose a replacement';
    overlay.appendChild(sub);

    // Card container
    const cardRow = document.createElement('div');
    cardRow.className = 'ko-picker-cards';

    livingGhosts.forEach((ghost, i) => {
      const rarityColor = RARITY_COLORS[ghost.rarity] || RARITY_COLORS.common;

      const card = document.createElement('div');
      card.className = 'ko-picker-card';
      card.style.setProperty('--ko-rarity-color', rarityColor);
      card.style.animationDelay = `${0.1 + i * 0.08}s`;

      // Rarity shimmer bar
      const rarBar = document.createElement('div');
      rarBar.className = 'ko-picker-rarity-bar';
      card.appendChild(rarBar);

      // Art
      const artUrl = ghost.art || getArtById(ghost.id);
      if (artUrl) {
        const img = document.createElement('img');
        img.className = 'ko-picker-card-art';
        img.src = artUrl;
        img.alt = ghost.name;
        img.draggable = false;
        img.onerror = function () {
          this.style.display = 'none';
        };
        card.appendChild(img);
      } else {
        // Placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'ko-picker-card-art';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.fontSize = '48px';
        placeholder.textContent = '\uD83D\uDC7B'; // ghost emoji
        card.appendChild(placeholder);
      }

      // Body
      const body = document.createElement('div');
      body.className = 'ko-picker-card-body';

      const name = document.createElement('div');
      name.className = 'ko-picker-card-name';
      name.textContent = ghost.name;
      body.appendChild(name);

      // HP bar
      const pct = ghost.maxHp > 0 ? ghost.hp / ghost.maxHp : 0;

      const hpText = document.createElement('div');
      hpText.className = 'ko-picker-hp-text';
      hpText.textContent = `WP ${ghost.hp} / ${ghost.maxHp}`;
      body.appendChild(hpText);

      const hpTrack = document.createElement('div');
      hpTrack.className = 'ko-picker-hp-track';
      const hpFill = document.createElement('div');
      hpFill.className = 'ko-picker-hp-fill' + (pct > 0.66 ? '' : pct > 0.33 ? ' hp-mid' : ' hp-low');
      hpFill.style.width = (pct * 100) + '%';
      hpTrack.appendChild(hpFill);
      body.appendChild(hpTrack);

      // Ability
      if (ghost.ability) {
        const abilName = document.createElement('div');
        abilName.className = 'ko-picker-ability-name';
        abilName.textContent = ghost.ability;
        body.appendChild(abilName);
      }

      if (ghost.abilityDesc) {
        const abilDesc = document.createElement('div');
        abilDesc.className = 'ko-picker-ability-desc';
        abilDesc.textContent = ghost.abilityDesc;
        body.appendChild(abilDesc);
      }

      card.appendChild(body);

      // Click handler
      card.addEventListener('click', () => {
        // Prevent double-pick
        if (card.classList.contains('ko-selected')) return;
        card.classList.add('ko-selected');

        // Pulse animation, then close
        setTimeout(() => {
          overlay.style.animation = 'koFadeOut 0.25s ease-in forwards';
          setTimeout(() => {
            overlay.remove();
            if (typeof callback === 'function') callback(ghost);
          }, 250);
        }, 350);
      });

      cardRow.appendChild(card);
    });

    overlay.appendChild(cardRow);
    document.body.appendChild(overlay);
  }

  // ── Hide (manual cleanup) ──
  function hide() {
    const el = document.getElementById('koPickerOverlay');
    if (el) {
      el.style.animation = 'koFadeOut 0.25s ease-in forwards';
      setTimeout(() => el.remove(), 250);
    }
  }

  // ── Helper: look up art from ALL_CARDS by id ──
  function getArtById(id) {
    if (typeof ALL_CARDS !== 'undefined' && Array.isArray(ALL_CARDS)) {
      const card = ALL_CARDS.find(c => c.id === id);
      if (card && card.art) return card.art;
    }
    return '';
  }

  // ── Public API ──
  window.KOPicker = { show, hide };
})();
