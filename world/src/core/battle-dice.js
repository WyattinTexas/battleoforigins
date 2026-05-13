/* ═══════════════════════════════════════════════════
   BATTLE DICE — Fake 3D pip-face dice (testroom2 port)
   DOM overlay that renders above the Phaser canvas.

   Usage (from BattleScene.js):
     BattleDice.show();
     BattleDice.setDice('player', [3, 5, 2]);
     BattleDice.setDice('enemy', [4, 1, 6]);
     BattleDice.tumble('player', 3, () => { ... });
     BattleDice.highlight([true, false, true], [false, true, false]);
     BattleDice.hide();
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Pip patterns for each die value (positions in 3x3 grid) ──
  const PIP_MAP = {
    1: ['mc'],
    2: ['tl', 'br'],
    3: ['tl', 'mc', 'br'],
    4: ['tl', 'tr', 'bl', 'br'],
    5: ['tl', 'tr', 'mc', 'bl', 'br'],
    6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
  };

  let layer = null;
  let playerRow = null;
  let enemyRow = null;
  let playerDice = [];
  let enemyDice = [];
  let playerResult = null;
  let enemyResult = null;

  // ── Create DOM ──
  function ensureDOM() {
    if (layer) return;

    layer = document.createElement('div');
    layer.className = 'battle-dice-layer';
    layer.id = 'battleDiceLayer';

    // Player dice
    playerRow = document.createElement('div');
    playerRow.className = 'dice-row player';
    playerRow.innerHTML = `
      <div>
        <div class="dice-label">PLAYER</div>
        <div class="dice-group" id="bdPlayerDice"></div>
        <div class="dice-result-text" id="bdPlayerResult"></div>
      </div>`;
    layer.appendChild(playerRow);

    // Enemy dice
    enemyRow = document.createElement('div');
    enemyRow.className = 'dice-row enemy';
    enemyRow.innerHTML = `
      <div>
        <div class="dice-label">ENEMY</div>
        <div class="dice-group" id="bdEnemyDice"></div>
        <div class="dice-result-text" id="bdEnemyResult"></div>
      </div>`;
    layer.appendChild(enemyRow);

    document.body.appendChild(layer);

    // Create 6 dice per side (max possible)
    const pGroup = document.getElementById('bdPlayerDice');
    const eGroup = document.getElementById('bdEnemyDice');

    for (let i = 0; i < 6; i++) {
      const pd = createDieElement();
      pGroup.appendChild(pd);
      playerDice.push(pd);

      const ed = createDieElement();
      eGroup.appendChild(ed);
      enemyDice.push(ed);
    }

    playerResult = document.getElementById('bdPlayerResult');
    enemyResult = document.getElementById('bdEnemyResult');
  }

  function createDieElement() {
    const die = document.createElement('div');
    die.className = 'bd-die';
    return die;
  }

  // ── Set pips on a die element for a given value ──
  function setPips(dieEl, value) {
    dieEl.innerHTML = '';
    const pips = PIP_MAP[value] || PIP_MAP[1];
    pips.forEach(pos => {
      const pip = document.createElement('div');
      pip.className = 'bd-pip ' + pos;
      dieEl.appendChild(pip);
    });
  }

  // ── Public API ──
  window.BattleDice = {
    /** Show the dice overlay layer */
    show() {
      ensureDOM();
      layer.classList.add('active');
      // Reset all dice
      playerDice.forEach(d => { d.className = 'bd-die'; d.innerHTML = ''; });
      enemyDice.forEach(d => { d.className = 'bd-die'; d.innerHTML = ''; });
      if (playerResult) playerResult.textContent = '';
      if (enemyResult) enemyResult.textContent = '';
    },

    /** Hide the dice overlay */
    hide() {
      if (layer) layer.classList.remove('active');
    },

    /** Set dice values for a side. values = array of numbers (1-6) */
    setDice(side, values) {
      ensureDOM();
      const dice = side === 'player' ? playerDice : enemyDice;
      dice.forEach((d, i) => {
        if (i < values.length) {
          setPips(d, values[i]);
          d.className = 'bd-die visible';
        } else {
          d.className = 'bd-die';
          d.innerHTML = '';
        }
      });
    },

    /** Tumble animation — show random faces rapidly, then resolve */
    tumble(side, count, finalValues, onComplete) {
      ensureDOM();
      const dice = side === 'player' ? playerDice : enemyDice;

      // Show the right number of dice with tumble class
      dice.forEach((d, i) => {
        if (i < count) {
          d.className = 'bd-die visible tumbling';
          setPips(d, Math.ceil(Math.random() * 6));
        } else {
          d.className = 'bd-die';
          d.innerHTML = '';
        }
      });

      // Rapid face changes during tumble
      const tumbleFrames = 8;
      const frameMs = 60;
      for (let t = 0; t < tumbleFrames; t++) {
        setTimeout(() => {
          dice.forEach((d, i) => {
            if (i < count) setPips(d, Math.ceil(Math.random() * 6));
          });
        }, t * frameMs);
      }

      // Resolve to final values
      setTimeout(() => {
        dice.forEach((d, i) => {
          if (i < count && finalValues[i]) {
            d.classList.remove('tumbling');
            setPips(d, finalValues[i]);
          }
        });
        if (onComplete) onComplete();
      }, tumbleFrames * frameMs + 80);
    },

    /** Tumble both sides simultaneously */
    tumbleBoth(pCount, eCount, pFinal, eFinal, onComplete) {
      ensureDOM();
      let done = 0;
      const check = () => { done++; if (done >= 2 && onComplete) onComplete(); };
      this.tumble('player', pCount, pFinal, check);
      this.tumble('enemy', eCount, eFinal, check);
    },

    /** Highlight winning/losing dice. winMask = [true, false, true, ...] */
    highlight(playerWinMask, enemyWinMask) {
      ensureDOM();
      playerDice.forEach((d, i) => {
        if (!d.classList.contains('visible')) return;
        if (playerWinMask && playerWinMask[i]) {
          d.classList.add('win');
          d.classList.remove('lose');
        } else if (playerWinMask) {
          d.classList.add('lose');
          d.classList.remove('win');
        }
      });
      enemyDice.forEach((d, i) => {
        if (!d.classList.contains('visible')) return;
        if (enemyWinMask && enemyWinMask[i]) {
          d.classList.add('win');
          d.classList.remove('lose');
        } else if (enemyWinMask) {
          d.classList.add('lose');
          d.classList.remove('win');
        }
      });
    },

    /** Set result text below dice */
    setResult(side, text, winning) {
      ensureDOM();
      const el = side === 'player' ? playerResult : enemyResult;
      if (el) {
        el.textContent = text;
        el.className = 'dice-result-text' + (winning ? ' winning' : '');
      }
    },

    /** Check if layer is visible */
    isActive() {
      return layer && layer.classList.contains('active');
    },

    /** Reposition dice rows (call if battle layout changes) */
    reposition(playerPos, enemyPos) {
      ensureDOM();
      if (playerPos) {
        playerRow.style.left = playerPos.x + 'px';
        playerRow.style.bottom = playerPos.y + 'px';
      }
      if (enemyPos) {
        enemyRow.style.right = enemyPos.x + 'px';
        enemyRow.style.bottom = enemyPos.y + 'px';
      }
    },
  };

  // Init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDOM);
  } else {
    ensureDOM();
  }
})();
