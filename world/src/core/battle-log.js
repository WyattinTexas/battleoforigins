// ============================================================
//  BattleLog — gilt-framed scrolling battle log panel
//  Battle of Origins · World
// ============================================================

const BattleLog = (() => {
  let container = null;
  let logBody = null;
  let injected = false;

  // --- Entry type colors ---
  const TYPE_COLORS = {
    roll:     '#d4a040',
    damage:   '#e94560',
    heal:     '#4ade80',
    ability:  '#9b59b6',
    ko:       '#8b0000',
    resource: '#4cc9f0',
    system:   '#6a6056',
    dodge:    '#44ddff',
  };

  // --- Inject CSS once ---
  function injectStyles() {
    if (injected) return;
    injected = true;

    const style = document.createElement('style');
    style.textContent = `
      /* ============================================================
         BATTLE LOG — fixed corner scroll (gilt-framed)
         ============================================================ */

      .battle-log {
        position: fixed;
        bottom: 18px;
        left: 18px;
        width: 280px;
        max-height: 200px;
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, rgba(20, 14, 28, 0.94), rgba(10, 6, 18, 0.90));
        border: 1px solid #d4a040;
        border-radius: 8px;
        padding: 10px 12px 8px;
        z-index: 10100;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 32px rgba(212,160,64,0.12);
        backdrop-filter: blur(10px);
        font-family: 'Courier New', Courier, monospace;
        font-size: 11px;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(12px);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }

      .battle-log.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* gilt accent line */
      .battle-log::before {
        content: '';
        position: absolute;
        top: -2px;
        left: 12px;
        right: 12px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #d4a040, transparent);
      }

      /* title bar */
      .battle-log-title {
        font-family: 'Cinzel Decorative', 'Cinzel', serif;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.4em;
        color: #f0d878;
        text-align: center;
        text-transform: uppercase;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(212, 160, 64, 0.3);
        flex-shrink: 0;
        user-select: none;
      }

      .battle-log-title::before,
      .battle-log-title::after {
        content: '\\2726';
        font-size: 7px;
        color: #d4a040;
        margin: 0 8px;
        vertical-align: middle;
        opacity: 0.7;
      }

      /* scrollable body */
      .battle-log-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: rgba(212,160,64,0.3) transparent;
      }

      .battle-log-body::-webkit-scrollbar {
        width: 4px;
      }
      .battle-log-body::-webkit-scrollbar-track {
        background: transparent;
      }
      .battle-log-body::-webkit-scrollbar-thumb {
        background: rgba(212,160,64,0.3);
        border-radius: 2px;
      }

      /* individual entries */
      .bl-entry {
        padding: 4px 0;
        line-height: 1.5;
        font-style: italic;
        border-bottom: 1px dotted rgba(255, 255, 255, 0.06);
        animation: bl-fade-in 0.2s ease both;
      }

      .bl-entry:last-child {
        border-bottom: none;
        font-style: normal;
        font-weight: 600;
      }

      @keyframes bl-fade-in {
        from { opacity: 0; transform: translateX(-6px); }
        to   { opacity: 1; transform: translateX(0); }
      }

      /* close button */
      .battle-log-close {
        position: absolute;
        top: 4px;
        right: 8px;
        background: none;
        border: none;
        color: #6a6056;
        cursor: pointer;
        font-size: 13px;
        line-height: 1;
        padding: 2px 4px;
        transition: color 0.15s;
      }
      .battle-log-close:hover {
        color: #d4a040;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Build DOM ---
  function ensureDOM() {
    if (container) return;
    injectStyles();

    container = document.createElement('div');
    container.className = 'battle-log';

    // close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'battle-log-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Close log';
    closeBtn.addEventListener('click', () => BattleLog.close());
    container.appendChild(closeBtn);

    // title
    const title = document.createElement('div');
    title.className = 'battle-log-title';
    title.textContent = 'BATTLE LOG';
    container.appendChild(title);

    // scrollable body
    logBody = document.createElement('div');
    logBody.className = 'battle-log-body';
    container.appendChild(logBody);

    document.body.appendChild(container);
  }

  // --- Public API ---

  return {
    /** Show the log panel */
    open() {
      ensureDOM();
      // Force reflow before adding class so transition fires
      void container.offsetHeight;
      container.classList.add('visible');
    },

    /** Hide the log panel */
    close() {
      if (!container) return;
      container.classList.remove('visible');
    },

    /**
     * Add an entry to the log.
     * @param {string} text  — the message
     * @param {string} [type='system'] — roll | damage | heal | ability | ko | resource | system | dodge
     */
    add(text, type = 'system') {
      ensureDOM();
      const entry = document.createElement('div');
      entry.className = 'bl-entry';
      entry.style.color = TYPE_COLORS[type] || TYPE_COLORS.system;
      entry.textContent = text;
      logBody.appendChild(entry);

      // auto-scroll to bottom
      requestAnimationFrame(() => {
        logBody.scrollTop = logBody.scrollHeight;
      });
    },

    /** Clear all log entries */
    clear() {
      if (!logBody) return;
      logBody.innerHTML = '';
    },
  };
})();

// Export for ES module or global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattleLog;
}
