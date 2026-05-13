/* ═══════════════════════════════════════════════════════════════
   ROLL ANNOUNCER — Battle of Origins World
   Dramatic presentation descriptors for each dice roll type.
   Pure data — no DOM, no rendering. Returns presentation objects
   that the UI layer consumes.

   Usage:
     const info = RollAnnouncer.announce(rollResult, isWinner, side);
     // → { text, color, glow, shake, flash, holdMs, cssClass, victoryMark, soundCue }

     const label = RollAnnouncer.formatResult(rollResult);
     // → "Triples · Fours"

   Expects rollResult from classify():
     { type: 'doubles', value: 5, damage: 2 }
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Value names ──
  const VALUE_NAMES = {
    1: 'Ones', 2: 'Twos', 3: 'Threes',
    4: 'Fours', 5: 'Fives', 6: 'Sixes'
  };
  const VALUE_SINGLE = {
    1: 'One', 2: 'Two', 3: 'Three',
    4: 'Four', 5: 'Five', 6: 'Six'
  };

  // ── Colors ──
  const CLR = {
    dim:     '#b8a44e',   // muted gold — singles
    bright:  '#ffd700',   // gold — doubles/triples
    hot:     '#ffaa00',   // amber — quads
    legend:  '#fff4b0',   // pale gold shimmer — penta
    rainbow: '#ffd700',   // base for rainbow effect (CSS handles shimmer)
  };

  // ── Announcement presets per roll type ──
  // Each returns a presentation descriptor object.

  function announceSingles(r, isWinner) {
    return {
      text:        `${VALUE_SINGLE[r.value]} High`,
      color:       CLR.dim,
      glow:        false,
      shake:       { intensity: 0.002, duration: 80 },
      flash:       false,
      holdMs:      800,
      cssClass:    'roll-singles',
      victoryMark: isWinner,
      soundCue:    'tap',
    };
  }

  function announceDoubles(r, isWinner) {
    return {
      text:        `DOUBLES \u00b7 ${VALUE_NAMES[r.value].toUpperCase()}!`,
      color:       CLR.bright,
      glow:        true,
      shake:       { intensity: 0.006, duration: 200 },
      flash:       false,
      holdMs:      1200,
      cssClass:    'roll-doubles',
      victoryMark: isWinner,
      soundCue:    'hit',
    };
  }

  function announceTriples(r, isWinner) {
    return {
      text:        `TRIPLES \u00b7 ${VALUE_NAMES[r.value].toUpperCase()}!!!`,
      color:       CLR.bright,
      glow:        true,
      shake:       { intensity: 0.012, duration: 350 },
      flash:       true,
      holdMs:      2000,
      cssClass:    'roll-triples',
      victoryMark: isWinner,
      soundCue:    'impact',
    };
  }

  function announceQuads(r, isWinner) {
    return {
      text:        `QUADS \u00b7 ${VALUE_NAMES[r.value].toUpperCase()}!!!!`,
      color:       CLR.hot,
      glow:        true,
      shake:       { intensity: 0.025, duration: 500 },
      flash:       true,
      holdMs:      2800,
      cssClass:    'roll-quads',
      victoryMark: isWinner,
      soundCue:    'explosion',
    };
  }

  function announcePenta(r, isWinner) {
    return {
      text:        `PENTA!!!! FIVE OF A KIND \u00b7 ${VALUE_NAMES[r.value].toUpperCase()}!!`,
      color:       CLR.legend,
      glow:        true,
      shake:       { intensity: 0.04, duration: 700 },
      flash:       true,
      holdMs:      3500,
      cssClass:    'roll-penta',
      victoryMark: isWinner,
      soundCue:    'legendary',
    };
  }

  function announceNOfAKind(r, isWinner) {
    return {
      text:        `${r.damage} OF A KIND \u00b7 ${VALUE_NAMES[r.value].toUpperCase()}!!!!!`,
      color:       CLR.rainbow,
      glow:        true,
      shake:       { intensity: 0.05, duration: 900 },
      flash:       true,
      holdMs:      4000,
      cssClass:    'roll-legendary',
      victoryMark: isWinner,
      soundCue:    'legendary',
    };
  }

  // ── Main API ──

  /**
   * announce(rollResult, isWinner, side)
   *
   * @param {Object}  rollResult — from classify(): { type, value, damage }
   * @param {boolean} isWinner   — did this roll win the round?
   * @param {string}  side       — 'red' | 'blue' (for directional styling)
   * @returns {Object} presentation descriptor
   */
  function announce(rollResult, isWinner, side) {
    if (!rollResult || rollResult.type === 'none') {
      return {
        text: '—', color: '#666', glow: false,
        shake: null, flash: false, holdMs: 400,
        cssClass: 'roll-none', victoryMark: false, soundCue: null,
      };
    }

    let info;
    const r = rollResult;

    if (r.type.endsWith('-of-a-kind'))  info = announceNOfAKind(r, isWinner);
    else if (r.type === 'penta')        info = announcePenta(r, isWinner);
    else if (r.type === 'quads')        info = announceQuads(r, isWinner);
    else if (r.type === 'triples')      info = announceTriples(r, isWinner);
    else if (r.type === 'doubles')      info = announceDoubles(r, isWinner);
    else                                info = announceSingles(r, isWinner);

    // Tag the side for directional effects
    info.side = side || null;

    // Losers get muted — shorter hold, no victory mark, quieter cue
    if (isWinner === false) {
      info.holdMs  = Math.max(600, Math.floor(info.holdMs * 0.5));
      info.shake   = info.shake ? { intensity: info.shake.intensity * 0.3, duration: info.shake.duration * 0.5 } : null;
      info.flash   = false;
      info.victoryMark = false;
      info.soundCue = info.soundCue === 'legendary' ? 'hit' : 'tap';
    }

    return info;
  }

  /**
   * formatResult(rollResult)
   *
   * Clean display text in testroom2 style:
   *   Singles  → "Six High"
   *   Doubles  → "Doubles · Fives"
   *   Triples  → "Triples · Fours"
   *   Quads    → "Quads · Threes!"
   *   Penta    → "Five of a Kind · Sixes!!"
   *   6+       → "6 of a Kind · Fours!!!"
   *
   * @param {Object} rollResult — from classify()
   * @returns {string}
   */
  function formatResult(r) {
    if (!r || r.type === 'none') return '—';

    const name = VALUE_NAMES[r.value] || r.value;

    if (r.type.endsWith('-of-a-kind')) return `${r.damage} of a Kind \u00b7 ${name}!!!`;
    if (r.type === 'penta')           return `Five of a Kind \u00b7 ${name}!!`;
    if (r.type === 'quads')           return `Quads \u00b7 ${name}!`;
    if (r.type === 'triples')         return `Triples \u00b7 ${name}`;
    if (r.type === 'doubles')         return `Doubles \u00b7 ${name}`;

    // Singles — "{Value} High"
    return `${VALUE_SINGLE[r.value] || r.value} High`;
  }

  // ── Export ──
  window.RollAnnouncer = { announce, formatResult };

})();
