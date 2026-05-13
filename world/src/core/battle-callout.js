/* ═══════════════════════════════════════════════════
   BATTLE CALLOUT SYSTEM — Battle of Origins World
   Dramatic drop-down banners for combat moments.
   Self-injecting DOM overlay (like StarfoxComm).

   Usage:
     BattleCallout.show('GRAND SPOILS!', { type: 'ability', subtitle: 'Valkin the Grand' });
     BattleCallout.show('-5 DAMAGE', { type: 'damage' });
     BattleCallout.show('KO!', { type: 'ko', subtitle: 'Shade has fallen' });
     BattleCallout.show('+3 HP', { type: 'heal', subtitle: 'Healing Seed' });
     BattleCallout.show('CRITICAL HIT!', { type: 'critical' });

   Options:
     type      — 'ability' | 'damage' | 'heal' | 'ko' | 'critical' (default: 'ability')
     subtitle  — optional second line of text
     duration  — ms to hold before exit (default: 2000)
     onDone    — callback when banner fully exits
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── CSS injection ──
  function ensureCSS() {
    if (document.getElementById('bcCalloutCSS')) return;
    const link = document.createElement('link');
    link.id = 'bcCalloutCSS';
    link.rel = 'stylesheet';
    // Resolve path relative to this script's location or fall back to root
    const scriptEl = document.querySelector('script[src*="battle-callout"]');
    if (scriptEl) {
      const base = scriptEl.src.substring(0, scriptEl.src.lastIndexOf('/src/'));
      link.href = base + '/battle-callout.css';
    } else {
      // Fallback: assume CSS is at the world root
      link.href = 'battle-callout.css';
    }
    document.head.appendChild(link);
  }

  // ── DOM container ──
  function ensureRoot() {
    let root = document.getElementById('battleCalloutRoot');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'battleCalloutRoot';
    root.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
    document.body.appendChild(root);
    return root;
  }

  // ── Queue: only one callout at a time ──
  const queue = [];
  let active = false;

  function processQueue() {
    if (active || queue.length === 0) return;
    active = true;
    const { text, opts } = queue.shift();
    _render(text, opts);
  }

  // ── Render a single callout ──
  function _render(text, opts) {
    ensureCSS();
    const root = ensureRoot();

    const type = (opts.type || 'ability').toLowerCase();
    const subtitle = opts.subtitle || '';
    const duration = opts.duration || 2000;
    const onDone = opts.onDone || null;

    // Build DOM
    const overlay = document.createElement('div');
    overlay.className = `bc-overlay bc-type-${type}`;

    const banner = document.createElement('div');
    banner.className = 'bc-banner';

    const textEl = document.createElement('div');
    textEl.className = 'bc-text';
    textEl.textContent = text;
    banner.appendChild(textEl);

    if (subtitle) {
      const sub = document.createElement('div');
      sub.className = 'bc-subtitle';
      sub.textContent = subtitle;
      banner.appendChild(sub);
    }

    overlay.appendChild(banner);
    root.appendChild(overlay);

    // Hold, then exit
    const holdTimer = setTimeout(() => {
      overlay.classList.add('bc-exit');

      const onEnd = () => {
        overlay.removeEventListener('animationend', onEnd);
        overlay.remove();
        active = false;
        if (onDone) onDone();
        processQueue();
      };
      overlay.addEventListener('animationend', onEnd);

      // Safety fallback in case animationend doesn't fire
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
          active = false;
          if (onDone) onDone();
          processQueue();
        }
      }, 800);
    }, duration);

    // Store timer ref for potential cleanup
    overlay._bcTimer = holdTimer;
  }

  // ── Public API ──
  const BattleCallout = {
    /**
     * Show a dramatic callout banner.
     * @param {string} text - Main text to display
     * @param {Object} [opts] - Options: type, subtitle, duration, onDone
     */
    show(text, opts = {}) {
      queue.push({ text, opts });
      processQueue();
    },

    /**
     * Immediately clear all active/queued callouts.
     */
    clear() {
      queue.length = 0;
      const root = document.getElementById('battleCalloutRoot');
      if (root) {
        root.querySelectorAll('.bc-overlay').forEach(el => {
          if (el._bcTimer) clearTimeout(el._bcTimer);
          el.remove();
        });
      }
      active = false;
    }
  };

  // ── Expose globally ──
  window.BattleCallout = BattleCallout;
})();
