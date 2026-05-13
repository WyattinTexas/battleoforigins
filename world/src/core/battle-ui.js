/* ============================================================
   BattleUI — DOM-based battle overlay for Battle of Origins World
   Replaces Phaser BattleScene rendering entirely.
   Uses testroom2 Theatre des Esprits visual language.
   ============================================================ */

(function () {
  'use strict';

  // ── Art path helper ──────────────────────────────────────────
  function artPath(ghost) {
    if (ghost.art) return ghost.art;
    // Fallback: derive from name
    const slug = (ghost.name || 'unknown').toLowerCase().replace(/\s+/g, '_');
    return `../testroom/art/originals/${slug}.png`;
  }

  // ── Rarity helpers ───────────────────────────────────────────
  function rarityClass(rarity) {
    if (!rarity) return 'common';
    const r = rarity.toLowerCase().replace(/[\s-]/g, '-');
    if (r === 'ghost-rare' || r === 'ghostrare') return 'ghost-rare';
    if (['common', 'uncommon', 'rare', 'legendary'].includes(r)) return r;
    return 'common';
  }

  function rarityLabel(rarity) {
    const map = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', 'ghost-rare': 'Ghost Rare', legendary: 'Legendary' };
    return map[rarityClass(rarity)] || 'Common';
  }

  // ── HP bar class ─────────────────────────────────────────────
  function hpFillClass(current, max) {
    const pct = current / max;
    if (pct > 0.5) return 'full';
    if (pct > 0.25) return 'mid';
    return 'low';
  }

  function hpColor(current, max) {
    const pct = current / max;
    if (pct > 0.5) return 'var(--hp-green)';
    if (pct > 0.25) return 'var(--hp-yellow)';
    return 'var(--hp-red)';
  }

  // ── Dice pip layout map ──────────────────────────────────────
  const PIP_MAP = {
    1: ['mc'],
    2: ['tl', 'br'],
    3: ['tl', 'mc', 'br'],
    4: ['tl', 'tr', 'bl', 'br'],
    5: ['tl', 'tr', 'mc', 'bl', 'br'],
    6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br']
  };

  // ── Resource config ──────────────────────────────────────────
  const RESOURCE_CONFIG = {
    moonstone: { icon: '\uD83D\uDC8E', label: 'Moon', cls: 'moonstone' },
    surge:     { icon: '\u26A1',       label: 'Surge', cls: 'surge' },
    ice:       { icon: '\u2744',       label: 'Ice',   cls: 'ice' },
    fire:      { icon: '\uD83D\uDD25', label: 'Fire',  cls: 'fire' },
    seed:      { icon: '\uD83C\uDF31', label: 'Seed',  cls: 'seed' },
    luck:      { icon: '\uD83C\uDF40', label: 'Luck',  cls: 'luck' }
  };

  // ── Crest SVG ────────────────────────────────────────────────
  function crestSVG(side) {
    const teamColor = side === 'player' ? '#e94560' : '#4cc9f0';
    const gradId = 'bo-crest-' + side;
    return `<svg viewBox="0 0 110 26" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fce598"/>
        <stop offset="45%" stop-color="#f0c560"/>
        <stop offset="100%" stop-color="#7a5818"/>
      </linearGradient></defs>
      <rect x="6" y="22" width="98" height="2" fill="url(#${gradId})" rx="1"/>
      <path d="M 8 22 Q 16 8 30 16 Q 38 20 32 22 Q 18 24 8 22 Z" fill="url(#${gradId})" opacity="0.92" stroke="#5c4a28" stroke-width="0.4"/>
      <path d="M 102 22 Q 94 8 80 16 Q 72 20 78 22 Q 92 24 102 22 Z" fill="url(#${gradId})" opacity="0.92" stroke="#5c4a28" stroke-width="0.4"/>
      <path d="M 55 0 L 46 18 L 64 18 Z" fill="url(#${gradId})" stroke="#5c4a28" stroke-width="0.7" stroke-linejoin="round"/>
      <circle cx="55" cy="13" r="2.4" fill="${teamColor}" stroke="#fce598" stroke-width="0.6"/>
      <circle cx="55" cy="13" r="0.9" fill="#fff5d8" opacity="0.7"/>
    </svg>`;
  }

  // ── Pelmet SVG ───────────────────────────────────────────────
  const PELMET_SVG = `<svg viewBox="0 0 460 14" preserveAspectRatio="none">
    <line x1="0" y1="7" x2="190" y2="7" stroke="currentColor" stroke-width="0.6"/>
    <circle cx="200" cy="7" r="2.5" fill="currentColor"/>
    <circle cx="220" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="0.8"/>
    <circle cx="240" cy="7" r="2.5" fill="currentColor"/>
    <path d="M 220 2 L 215 7 L 220 12 L 225 7 Z" fill="none" stroke="currentColor" stroke-width="0.6"/>
    <line x1="270" y1="7" x2="460" y2="7" stroke="currentColor" stroke-width="0.6"/>
  </svg>`;

  // ── DOM element ──────────────────────────────────────────────
  let _overlay = null;
  let _refs = {};
  let _fightCb = null;
  let _runCb = null;
  let _calloutTimer = null;

  // ── Build the full overlay DOM ───────────────────────────────
  function buildOverlay() {
    if (_overlay) return;

    const el = document.createElement('div');
    el.className = 'battle-overlay';

    // Atmosphere
    let motesHTML = '';
    for (let i = 0; i < 10; i++) motesHTML += '<div class="bo-mote"></div>';

    el.innerHTML = `
      <div class="bo-atmosphere"></div>
      <div class="bo-motes">${motesHTML}</div>
      <div class="bo-theater">
        <div class="bo-stage-pelmet">${PELMET_SVG}</div>
        <main class="bo-stage">
          <div class="team-area" data-side="player"></div>
          <div class="dice-arena">
            <div class="dice-team-block" data-dice="player">
              <div class="dice-team-tag red">-- Player Rolls --</div>
              <div class="dice-row"></div>
              <div class="dice-result"></div>
            </div>
            <div class="vs-divider">VS</div>
            <div class="dice-team-block" data-dice="enemy">
              <div class="dice-team-tag blue">-- Enemy Rolls --</div>
              <div class="dice-row"></div>
              <div class="dice-result"></div>
            </div>
            <div class="roll-buttons">
              <button class="roll-btn fight">Fight</button>
              <button class="roll-btn run">Run</button>
            </div>
          </div>
          <div class="team-area" data-side="enemy"></div>
        </main>
        <footer class="bo-resources-bar"></footer>
      </div>
      <aside class="battle-log">
        <div class="battle-log-title">Battle Log</div>
        <div class="battle-log-entries"></div>
      </aside>
    `;

    // Wire buttons
    el.querySelector('.roll-btn.fight').addEventListener('click', () => { if (_fightCb) _fightCb(); });
    el.querySelector('.roll-btn.run').addEventListener('click', () => { if (_runCb) _runCb(); });

    // Store refs
    _refs = {
      playerArea: el.querySelector('[data-side="player"]'),
      enemyArea: el.querySelector('[data-side="enemy"]'),
      playerDice: el.querySelector('[data-dice="player"]'),
      enemyDice: el.querySelector('[data-dice="enemy"]'),
      resourcesBar: el.querySelector('.bo-resources-bar'),
      logEntries: el.querySelector('.battle-log-entries'),
      battleLog: el.querySelector('.battle-log'),
      fightBtn: el.querySelector('.roll-btn.fight'),
      runBtn: el.querySelector('.roll-btn.run')
    };

    document.body.appendChild(el);
    _overlay = el;
  }

  // ── Build a fighter card HTML ────────────────────────────────
  function fighterCardHTML(ghost, side) {
    const teamClass = side === 'player' ? 'red' : 'blue';
    const teamLabel = side === 'player' ? 'Your Team' : 'Enemy Team';
    const rc = rarityClass(ghost.rarity);
    const hp = ghost.hp || ghost.currentHp || ghost.maxHp || 6;
    const maxHp = ghost.maxHp || ghost.hp || 6;
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const fillCls = hpFillClass(hp, maxHp);
    const hpCol = hpColor(hp, maxHp);

    let ticksHTML = '';
    for (let i = 0; i < maxHp; i++) ticksHTML += '<div class="hp-tick"></div>';

    const imgSrc = artPath(ghost);
    const name = ghost.name || 'Unknown';
    const abilityName = ghost.ability || ghost.abilityName || '';
    const abilityText = ghost.abilityDesc || ghost.desc || ghost.abilityText || ghost.description || '';

    return `
      <div class="fighter-card-wrap ${teamClass}">
        <div class="card-crest">${crestSVG(side)}</div>
        <div class="fighter-card ${teamClass}">
          <div class="fighter-team-tag ${teamClass}">${teamLabel}</div>
          <div class="fighter-art-frame">
            <span class="rarity-badge ${rc}">${rarityLabel(ghost.rarity)}</span>
            <img src="${imgSrc}" alt="${name}" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex'">
            <div class="placeholder" style="display:none">${name.toUpperCase()}</div>
            <div class="fighter-name-banner">
              <div class="fighter-name">${name}</div>
            </div>
          </div>
          <div class="fighter-hp-section">
            <div class="hp-label-row">
              <div class="hp-label">-- Vitality --</div>
              <div class="hp-value">
                <span class="current" style="color:${hpCol}">${hp}</span><span class="sep">/</span><span class="max">${maxHp}</span>
              </div>
            </div>
            <div class="hp-bar">
              <div class="hp-bar-fill ${fillCls}" style="width:${pct}%"></div>
              <div class="hp-bar-ticks">${ticksHTML}</div>
            </div>
          </div>
          <div class="fighter-ability">
            <div class="ability-name">${abilityName}</div>
            <div class="ability-text">${abilityText}</div>
          </div>
        </div>
      </div>`;
  }

  // ── Build a sideline card HTML ───────────────────────────────
  function sidelineCardHTML(ghost, side) {
    const teamClass = side === 'player' ? 'red' : 'blue';
    const rc = rarityClass(ghost.rarity);
    const hp = ghost.hp || ghost.currentHp || ghost.maxHp || 6;
    const maxHp = ghost.maxHp || ghost.hp || 6;
    const imgSrc = artPath(ghost);
    const name = ghost.name || 'Unknown';
    const abilityName = ghost.ability || ghost.abilityName || '';
    const abilityText = ghost.abilityDesc || ghost.desc || ghost.abilityText || ghost.description || '';
    const hpCol = hpColor(hp, maxHp);
    const isKO = ghost.ko || hp <= 0;

    return `
      <div class="sideline-card ${teamClass}${isKO ? ' ko' : ''}">
        <div class="sideline-art">
          <div class="sideline-rarity ${rc}"></div>
          <div class="sideline-hp-pill" style="color:${hpCol};border-color:${hpCol}">${isKO ? 'KO' : `&#9829; ${hp}/${maxHp}`}</div>
          <img src="${imgSrc}" alt="${name}" onerror="this.style.display='none';this.parentElement.innerHTML+='<div class=placeholder>${name.substring(0,4).toUpperCase()}</div>'">
          <div class="sideline-name-strip">
            <div class="sideline-name">${name}</div>
          </div>
        </div>
        <div class="sideline-info">
          <div class="sideline-ability">${abilityName}</div>
          <div class="sideline-ability-text">${abilityText}</div>
        </div>
      </div>`;
  }

  // ── Build a die HTML ─────────────────────────────────────────
  function dieHTML(value, isWin) {
    const pips = PIP_MAP[value] || PIP_MAP[1];
    const winCls = isWin ? ' win' : '';
    return `<div class="die${winCls}">${pips.map(p => `<div class="pip ${p}"></div>`).join('')}</div>`;
  }

  // ── Render a full team area ──────────────────────────────────
  function renderTeamArea(areaEl, team, activeIdx, side) {
    if (!team || team.length === 0) { areaEl.innerHTML = ''; return; }

    const idx = activeIdx != null ? activeIdx : 0;
    const active = team[idx];
    const bench = team.filter((_, i) => i !== idx);

    let html = '';

    // Sideline row
    if (bench.length > 0) {
      html += `<div class="sideline-row ${side === 'player' ? 'red' : 'blue'}">`;
      bench.forEach(g => { html += sidelineCardHTML(g, side); });
      html += '</div>';
    }

    // Active fighter
    html += fighterCardHTML(active, side);

    areaEl.innerHTML = html;
  }

  // ── PUBLIC API ───────────────────────────────────────────────

  const BattleUI = {

    /**
     * Open the battle overlay.
     * @param {Array} playerTeam - Array of ghost objects [{name, rarity, hp, maxHp, art, abilityName, abilityText, ...}]
     * @param {Array} enemyTeam  - Same format
     * @param {number} [playerActiveIdx=0]
     * @param {number} [enemyActiveIdx=0]
     */
    open(playerTeam, enemyTeam, playerActiveIdx = 0, enemyActiveIdx = 0) {
      buildOverlay();

      // Clear previous state
      _refs.logEntries.innerHTML = '';
      _refs.resourcesBar.innerHTML = '';
      _refs.playerDice.querySelector('.dice-row').innerHTML = '';
      _refs.playerDice.querySelector('.dice-result').innerHTML = '';
      _refs.enemyDice.querySelector('.dice-row').innerHTML = '';
      _refs.enemyDice.querySelector('.dice-result').innerHTML = '';

      // Remove any stale callout
      const oldCallout = _overlay.querySelector('.callout-overlay');
      if (oldCallout) oldCallout.remove();

      // Remove any stale KO picker
      const oldPicker = _overlay.querySelector('.ko-picker-backdrop');
      if (oldPicker) oldPicker.remove();

      // Store teams
      _overlay._playerTeam = playerTeam;
      _overlay._enemyTeam = enemyTeam;
      _overlay._playerActiveIdx = playerActiveIdx;
      _overlay._enemyActiveIdx = enemyActiveIdx;

      // Render team areas
      renderTeamArea(_refs.playerArea, playerTeam, playerActiveIdx, 'player');
      renderTeamArea(_refs.enemyArea, enemyTeam, enemyActiveIdx, 'enemy');

      // Show
      _overlay.classList.add('active');

      // Log entry
      if (playerTeam[playerActiveIdx] && enemyTeam[enemyActiveIdx]) {
        this.addLogEntry(
          `<span class="red-text">${playerTeam[playerActiveIdx].name}</span> vs <span class="blue-text">${enemyTeam[enemyActiveIdx].name}</span> -- Battle begins!`
        );
      }
    },

    /**
     * Close and clean up the battle overlay.
     */
    close() {
      if (!_overlay) return;
      _overlay.classList.remove('active');
      if (_calloutTimer) { clearTimeout(_calloutTimer); _calloutTimer = null; }
    },

    /**
     * Update the active fighter card for a side.
     * @param {'player'|'enemy'} side
     * @param {Object} ghost - Ghost object with updated stats
     */
    updateFighter(side, ghost) {
      if (!_overlay) return;
      const area = side === 'player' ? _refs.playerArea : _refs.enemyArea;
      const wrap = area.querySelector('.fighter-card-wrap');
      if (!wrap) return;

      // Replace the fighter card
      const temp = document.createElement('div');
      temp.innerHTML = fighterCardHTML(ghost, side);
      const newWrap = temp.firstElementChild;
      wrap.replaceWith(newWrap);
    },

    /**
     * Update the sideline row for a side.
     * @param {'player'|'enemy'} side
     * @param {Array} ghosts - Full team array
     * @param {number} activeIdx - Index of the active fighter
     */
    updateSideline(side, ghosts, activeIdx) {
      if (!_overlay) return;
      const area = side === 'player' ? _refs.playerArea : _refs.enemyArea;
      renderTeamArea(area, ghosts, activeIdx, side);

      // Update stored state
      if (side === 'player') {
        _overlay._playerTeam = ghosts;
        _overlay._playerActiveIdx = activeIdx;
      } else {
        _overlay._enemyTeam = ghosts;
        _overlay._enemyActiveIdx = activeIdx;
      }
    },

    /**
     * Show dice results for a side.
     * @param {'player'|'enemy'} side
     * @param {number[]} values - Array of die values (e.g. [3, 3, 5])
     * @param {boolean} isWinner - Whether this side won the roll
     */
    showDice(side, values, isWinner) {
      if (!_overlay) return;
      const block = side === 'player' ? _refs.playerDice : _refs.enemyDice;
      const row = block.querySelector('.dice-row');

      row.innerHTML = values.map(v => dieHTML(v, isWinner)).join('');
    },

    /**
     * Show the roll result text (e.g. "Doubles - Threes").
     * @param {'player'|'enemy'} side
     * @param {string} text - The result description
     * @param {boolean} isWinner
     */
    showRollResult(side, text, isWinner) {
      if (!_overlay) return;
      const block = side === 'player' ? _refs.playerDice : _refs.enemyDice;
      const result = block.querySelector('.dice-result');

      if (isWinner) {
        result.className = 'dice-result winning';
        result.innerHTML = `${text} <span class="victory-mark">\u2605</span>`;
      } else {
        result.className = 'dice-result';
        result.textContent = text;
      }
    },

    /**
     * Update the HP bar for the active fighter on a side.
     * @param {'player'|'enemy'} side
     * @param {number} current
     * @param {number} max
     */
    updateHP(side, current, max) {
      if (!_overlay) return;
      const area = side === 'player' ? _refs.playerArea : _refs.enemyArea;
      const hpSection = area.querySelector('.fighter-hp-section');
      if (!hpSection) return;

      const pct = Math.max(0, Math.min(100, (current / max) * 100));
      const fillCls = hpFillClass(current, max);
      const col = hpColor(current, max);

      // Update bar fill
      const fill = hpSection.querySelector('.hp-bar-fill');
      if (fill) {
        fill.className = `hp-bar-fill ${fillCls}`;
        fill.style.width = pct + '%';
      }

      // Update text
      const currentEl = hpSection.querySelector('.hp-value .current');
      if (currentEl) {
        currentEl.textContent = current;
        currentEl.style.color = col;
      }
    },

    /**
     * Update the resource tiles at the bottom.
     * @param {Object} resources - e.g. { moonstone: 2, ice: 1, fire: 0 }
     */
    updateResources(resources) {
      if (!_overlay || !resources) return;

      let html = '';
      for (const [key, cfg] of Object.entries(RESOURCE_CONFIG)) {
        const count = resources[key] || 0;
        if (count <= 0) continue; // Only show non-zero
        html += `
          <div class="resource-tile ${cfg.cls}${count > 0 ? ' clickable' : ' empty'}">
            <div class="resource-icon">${cfg.icon}</div>
            <div class="resource-count">${count}</div>
            <div class="resource-label">${cfg.label}</div>
          </div>`;
      }

      _refs.resourcesBar.innerHTML = html;
    },

    /**
     * Show a dramatic callout banner.
     * @param {string} text - Main text (e.g. "Forge!")
     * @param {string} [type='ability'] - 'ability'|'damage'|'heal'|'gold'
     * @param {string} [subtitle] - Optional subtitle
     * @param {number} [duration=2200] - Ms before auto-dismiss
     */
    showCallout(text, type = 'ability', subtitle = '', duration = 2200) {
      if (!_overlay) return;

      // Remove existing
      const old = _overlay.querySelector('.callout-overlay');
      if (old) old.remove();
      if (_calloutTimer) clearTimeout(_calloutTimer);

      const typeCls = type === 'ability' ? '' : ` ${type}`;

      const callout = document.createElement('div');
      callout.className = 'callout-overlay';
      callout.innerHTML = `
        <div class="callout-banner${typeCls}">
          <h2 class="callout-text">${text}</h2>
          ${subtitle ? `<div class="callout-subtitle">${subtitle}</div>` : ''}
        </div>`;

      _overlay.appendChild(callout);

      _calloutTimer = setTimeout(() => {
        callout.style.transition = 'opacity 0.4s';
        callout.style.opacity = '0';
        setTimeout(() => callout.remove(), 450);
      }, duration);
    },

    /**
     * Wire up the fight button.
     * @param {Function} callback
     */
    onFightClick(callback) {
      _fightCb = callback;
    },

    /**
     * Wire up the run button.
     * @param {Function} callback
     */
    onRunClick(callback) {
      _runCb = callback;
    },

    /**
     * Add an entry to the battle log.
     * @param {string} text - HTML allowed for colored spans
     * @param {string} [color] - Optional override color
     */
    addLogEntry(text, color) {
      if (!_overlay) return;
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = text;
      if (color) entry.style.color = color;

      _refs.logEntries.appendChild(entry);

      // Auto-scroll
      _refs.battleLog.scrollTop = _refs.battleLog.scrollHeight;
    },

    /**
     * Show a KO swap picker modal.
     * @param {Array} ghosts - Array of available ghosts to swap in
     * @param {Function} callback - Called with the selected ghost object
     */
    showKOPicker(ghosts, callback) {
      if (!_overlay) return;

      // Remove existing
      const old = _overlay.querySelector('.ko-picker-backdrop');
      if (old) old.remove();

      const backdrop = document.createElement('div');
      backdrop.className = 'ko-picker-backdrop';

      let cardsHTML = ghosts.map((g, i) => {
        const rc = rarityClass(g.rarity);
        const hp = g.hp || g.currentHp || g.maxHp || 6;
        const maxHp = g.maxHp || g.hp || 6;
        const imgSrc = artPath(g);
        const name = g.name || 'Unknown';
        const abilityName = g.abilityName || g.ability || '';
        const abilityText = g.abilityText || g.description || '';
        const hpCol = hpColor(hp, maxHp);

        return `
          <div class="ko-picker-ghost" data-idx="${i}">
            <div class="sideline-art">
              <div class="sideline-rarity ${rc}"></div>
              <div class="sideline-hp-pill" style="color:${hpCol};border-color:${hpCol}">&#9829; ${hp}/${maxHp}</div>
              <img src="${imgSrc}" alt="${name}" onerror="this.style.display='none'">
              <div class="sideline-name-strip">
                <div class="sideline-name">${name}</div>
              </div>
            </div>
            <div class="sideline-info">
              <div class="sideline-ability">${abilityName}</div>
              <div class="sideline-ability-text">${abilityText}</div>
            </div>
          </div>`;
      }).join('');

      backdrop.innerHTML = `
        <div class="ko-picker">
          <div class="ko-picker-title">Choose Your Next Fighter</div>
          <div class="ko-picker-ghosts">${cardsHTML}</div>
        </div>`;

      // Wire click handlers
      backdrop.querySelectorAll('.ko-picker-ghost').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.getAttribute('data-idx'), 10);
          backdrop.remove();
          if (callback) callback(ghosts[idx]);
        });
      });

      _overlay.appendChild(backdrop);
    },

    /**
     * Get a reference to the overlay element (for advanced usage).
     */
    getOverlay() {
      buildOverlay();
      return _overlay;
    },

    /**
     * Enable/disable the fight button.
     * @param {boolean} enabled
     */
    setFightEnabled(enabled) {
      if (_refs.fightBtn) {
        _refs.fightBtn.disabled = !enabled;
        _refs.fightBtn.style.opacity = enabled ? '1' : '0.4';
        _refs.fightBtn.style.pointerEvents = enabled ? 'auto' : 'none';
      }
    },

    /**
     * Clear the dice display for a side.
     * @param {'player'|'enemy'} side
     */
    clearDice(side) {
      if (!_overlay) return;
      const block = side === 'player' ? _refs.playerDice : _refs.enemyDice;
      block.querySelector('.dice-row').innerHTML = '';
      block.querySelector('.dice-result').innerHTML = '';
      block.querySelector('.dice-result').className = 'dice-result';
    }
  };

  // ── Expose globally ──────────────────────────────────────────
  window.BattleUI = BattleUI;

})();
