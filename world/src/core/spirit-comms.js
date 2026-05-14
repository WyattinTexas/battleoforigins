// SPIRIT COMMS — Star Fox 64-style dialogue system
// Replaces the old dialogue overlay with comm boxes
// All functions and variables remain global.

// ═══════ NPC → SPIRITKIN PORTRAIT MAP ═══════
// Maps NPC names to a Spiritkin art path + name color
const NPC_COMM_PORTRAITS = {
  // Friendly NPCs
  'Elder Frost':     { art: 'https://drbango.com/testroom/art/originals/Cornelius.png', color: '#daa520' },
  'Smith Ember':     { art: 'https://drbango.com/testroom/art/gary.png',                color: '#ff6633' },
  'Crazy Lou':     { art: 'https://drbango.com/testroom/art/originals/Katrina.png',   color: '#c0a040' },
  'Farmer Bea':      { art: 'https://drbango.com/testroom/art/originals/Flora.png',     color: '#6a8a4a' },
  'Herbalist Sage':  { art: 'https://drbango.com/testroom/art/originals/Cornelius.png', color: '#4a8a6a' },
  'Captain Flint':   { art: 'https://drbango.com/testroom/art/originals/Floop.png',     color: '#cc6644' },
  'Lava Tender':     { art: 'https://drbango.com/testroom/art/originals/Haywire.png',   color: '#ff8844' },
  'Shadow Warden':   { art: 'https://drbango.com/testroom/art/originals/DarkWing.png',  color: '#8a6aaa' },
  'Cursed Scholar':  { art: 'https://drbango.com/testroom/art/originals/AncientLibrarian.png', color: '#6a4a8a' },
  // Hostile NPCs
  'Brawler Jax':       { art: 'https://drbango.com/testroom/art/originals/Hugo.png',      color: '#cc4444' },
  'Ice Queen Vera':    { art: 'https://drbango.com/testroom/art/originals/Sonya.png',     color: '#6688cc' },
  'Bandit Marcus':     { art: 'https://drbango.com/testroom/art/originals/Outlaw.png',    color: '#aa8844' },
  'Lava Raider Kira':  { art: 'https://drbango.com/testroom/art/originals/Kodako.png',    color: '#ee8844' },
  'Shadow Knight Vex': { art: 'https://drbango.com/testroom/art/originals/DarkJeff.png',  color: '#8866aa' },
  'The Exile':         { art: 'https://drbango.com/testroom/art/originals/Wanderer.png',  color: '#666666' },
  // Quest NPCs
  'Maren':    { art: 'https://drbango.com/testroom/art/originals/Tabitha.png',  color: '#d4a44a' },
  'Leon':     { art: 'https://drbango.com/testroom/art/originals/FangOutside.png', color: '#cc5544' },
  'Valkin':   { art: 'https://drbango.com/testroom/art/originals/ValkinTheGrand.png', color: '#aa44ff' },
  // Dungeon antagonists
  'King Jay': { art: 'https://drbango.com/testroom/art/originals/king_jay.jpg', color: '#aa66cc' },
  // Cantina NPCs
  'Grix':             { art: 'https://drbango.com/testroom/art/originals/Greg.png',      color: '#daa520' },
  'Grix the Bartender': { art: 'https://drbango.com/testroom/art/originals/Greg.png',    color: '#daa520' },
  'Lyra':             { art: 'https://drbango.com/testroom/art/originals/Sonya.png',     color: '#c080e0' },
  'Lyra the Bard':    { art: 'https://drbango.com/testroom/art/originals/Sonya.png',     color: '#c080e0' },
  'Old Frost':        { art: 'https://drbango.com/testroom/art/originals/Hermit.png',    color: '#88bbdd' },
  'Old Frost the Lorekeeper': { art: 'https://drbango.com/testroom/art/originals/Hermit.png', color: '#88bbdd' },
  '???':              { art: 'https://drbango.com/testroom/art/originals/Shade.png',     color: '#4a4a6a' },
  '??? the Hooded Figure': { art: 'https://drbango.com/testroom/art/originals/Shade.png', color: '#4a4a6a' },
  'The Bar':          { art: 'https://drbango.com/testroom/art/originals/Greg.png',      color: '#daa520' },
  'Dice Table':       { art: 'https://drbango.com/testroom/art/originals/Charlie.png',   color: '#90b060' },
  'Locked Door':      { art: 'https://drbango.com/testroom/art/originals/DarkWing.png',  color: '#8a4a4a' },
  'The Firepit':      { art: 'https://drbango.com/testroom/art/gary.png',                color: '#ff8844' },
  // Inn NPCs
  'Mara':             { art: 'https://drbango.com/testroom/art/originals/Tabitha.png',   color: '#d4956a' },
  'Mara the Innkeeper': { art: 'https://drbango.com/testroom/art/originals/Tabitha.png', color: '#d4956a' },
  'Bramble':          { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#8a6040' },
  'Bramble the Cook': { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#8a6040' },
  'Reception Desk':   { art: 'https://drbango.com/testroom/art/originals/Tabitha.png',   color: '#d4956a' },
  'The Hearth':       { art: 'https://drbango.com/testroom/art/gary.png',                color: '#ff9944' },
  'Cozy Bed':         { art: 'https://drbango.com/testroom/art/originals/LittleBoo.png', color: '#7a8aaa' },
  'Old Book':         { art: 'https://drbango.com/testroom/art/originals/AncientLibrarian.png', color: '#8a7a5a' },
  'Stew Pot':         { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#aa7744' },
  'Kitchen Counter':  { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#8a6a3a' },
  // Workshop NPCs
  'Smith Ember the Master Smith': { art: 'https://drbango.com/testroom/art/gary.png', color: '#cc6633' },
  'Pip the Apprentice':     { art: 'https://drbango.com/testroom/art/originals/Pip.png',       color: '#88bb55' },
  'The Anvil':              { art: 'https://drbango.com/testroom/art/gary.png',                color: '#cc9944' },
  'The Forge':              { art: 'https://drbango.com/testroom/art/gary.png',                color: '#ff8844' },
  'Workbench':              { art: 'https://drbango.com/testroom/art/originals/Greg.png',      color: '#8a6a3a' },
  'Quenching Trough':       { art: 'https://drbango.com/testroom/art/originals/Wim.png',       color: '#6688aa' },
  'Schematic Table':        { art: 'https://drbango.com/testroom/art/originals/AncientLibrarian.png', color: '#bbaa77' },
  'Display Case':           { art: 'https://drbango.com/testroom/art/originals/Sparky.png',    color: '#aaaacc' },
  'Material Storage':       { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#bb8844' },
  'Supply Crate':           { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#7a5a2a' },
  'The Bellows':            { art: 'https://drbango.com/testroom/art/gary.png',                color: '#8a7040' },
  'Tool Rack':              { art: 'https://drbango.com/testroom/art/gary.png',                color: '#777777' },
  'Coal Bin':               { art: 'https://drbango.com/testroom/art/originals/DarkWing.png',  color: '#333333' },
  // Arena NPCs
  'Kael':                   { art: 'https://drbango.com/testroom/art/originals/Hugo.png',      color: '#cc4444' },
  'Kael the Arena Master':  { art: 'https://drbango.com/testroom/art/originals/Hugo.png',      color: '#cc4444' },
  'Vex':                    { art: 'https://drbango.com/testroom/art/originals/Wanderer.png',  color: '#88aacc' },
  'Vex the Old Champion':   { art: 'https://drbango.com/testroom/art/originals/Wanderer.png',  color: '#88aacc' },
  'Finn the Bookie':        { art: 'https://drbango.com/testroom/art/finn.png',                color: '#aa9944' },
  'Trophy Case':            { art: 'https://drbango.com/testroom/art/originals/Hugo.png',      color: '#daa520' },
  'Weapon Rack':            { art: 'https://drbango.com/testroom/art/originals/Hugo.png',      color: '#8899aa' },
  "Challenger's Gate":      { art: 'https://drbango.com/testroom/art/originals/DarkWing.png',  color: '#667788' },
  'Betting Desk':           { art: 'https://drbango.com/testroom/art/finn.png',                color: '#aa9944' },
  'Torch Pillar':           { art: 'https://drbango.com/testroom/art/gary.png',                color: '#ff8844' },
  // Castle NPCs
  "Valkin's Echo":          { art: 'https://drbango.com/testroom/art/originals/ValkinTheGrand.png', color: '#8040c0' },
  "Valkin's Echo the Phantom": { art: 'https://drbango.com/testroom/art/originals/ValkinTheGrand.png', color: '#8040c0' },
  'Archivist Maren':        { art: 'https://drbango.com/testroom/art/originals/Tabitha.png',   color: '#7a8a6a' },
  'Archivist Maren the Imprisoned Scholar': { art: 'https://drbango.com/testroom/art/originals/Tabitha.png', color: '#7a8a6a' },
  'The Throne':             { art: 'https://drbango.com/testroom/art/originals/ValkinTheGrand.png', color: '#8040c0' },
  'Ancient Tome':           { art: 'https://drbango.com/testroom/art/originals/AncientLibrarian.png', color: '#6a7a9a' },
  'Treasure Chest':         { art: 'https://drbango.com/testroom/art/originals/Charlie.png',   color: '#daa520' },
  'Dark Altar':             { art: 'https://drbango.com/testroom/art/originals/ValkinTheGrand.png', color: '#a040a0' },
  'Prison Cell':            { art: 'https://drbango.com/testroom/art/originals/Shade.png',     color: '#6a6a7a' },
  // House objects
  'Your Bed':               { art: 'https://drbango.com/testroom/art/originals/LittleBoo.png', color: '#8899cc' },
  'Trophy Chest':           { art: 'https://drbango.com/testroom/art/originals/Charlie.png',   color: '#daa520' },
  'Fireplace':              { art: 'https://drbango.com/testroom/art/gary.png',                color: '#ff8844' },
  'Table':                  { art: 'https://drbango.com/testroom/art/originals/Greg.png',      color: '#7a5a30' },
  'Window':                 { art: 'https://drbango.com/testroom/art/originals/Sky.png',       color: '#aaccee' },
  // Trading Post
  'Trade Counter':          { art: 'https://drbango.com/testroom/art/originals/Greg.png',      color: '#b8860b' },
  'Goods Display':          { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#8b7355' },
  'Display Table':          { art: 'https://drbango.com/testroom/art/originals/Chester.png',   color: '#8b7355' },
  // Adventure / Dialogue Sheet NPCs
  'Toby':             { art: 'https://drbango.com/testroom/art/originals/Toby.png',      color: '#44aaff' },
  'Ember':            { art: 'https://drbango.com/testroom/art/gary.png',                color: '#ff6633' },
  'Frostweaver':      { art: 'https://drbango.com/testroom/art/originals/Wim.png',       color: '#88bbdd' },
  'Slag':             { art: 'https://drbango.com/testroom/art/originals/Haywire.png',   color: '#ff8844' },
  'The Whisper':      { art: 'https://drbango.com/testroom/art/originals/Shade.png',     color: '#6a4a8a' },
  'Ancient Spirit':   { art: 'https://drbango.com/testroom/art/originals/AncientLibrarian.png', color: '#c0a040' },
  'Hooded Figure':    { art: 'https://drbango.com/testroom/art/originals/DarkWing.png',  color: '#4a4a6a' },
  'Narrator':         { art: 'https://drbango.com/testroom/art/originals/Toby.png',      color: '#88aacc' },
  // System / narrator
  'System':           { art: 'https://drbango.com/testroom/art/originals/Toby.png',      color: '#44aaff' },
};

// ═══════ COMM STATE ═══════
let commQueue = [];
let commTyping = false;
let commTypeTimer = null;
let commCurrentCallback = null;

// Audio context for SFX
let commAudioCtx = null;

function commInitAudio() {
  if (!commAudioCtx) {
    try { commAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { /* silent fail */ }
  }
}

function commPlayBlip() {
  if (!commAudioCtx) return;
  try {
    const osc = commAudioCtx.createOscillator();
    const gain = commAudioCtx.createGain();
    osc.connect(gain);
    gain.connect(commAudioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, commAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, commAudioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, commAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, commAudioCtx.currentTime + 0.1);
    osc.start(commAudioCtx.currentTime);
    osc.stop(commAudioCtx.currentTime + 0.1);
  } catch(e) {}
}

function commPlayTypeBlip() {
  if (!commAudioCtx) return;
  try {
    const osc = commAudioCtx.createOscillator();
    const gain = commAudioCtx.createGain();
    osc.connect(gain);
    gain.connect(commAudioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200 + Math.random() * 80, commAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.025, commAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, commAudioCtx.currentTime + 0.04);
    osc.start(commAudioCtx.currentTime);
    osc.stop(commAudioCtx.currentTime + 0.04);
  } catch(e) {}
}

// ═══════ DOM SETUP ═══════
// Creates the comm overlay once on first use
let commOverlayReady = false;

function ensureCommOverlay() {
  if (commOverlayReady) return;
  commOverlayReady = true;

  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    #spiritCommOverlay {
      position: fixed;
      bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 1200;
      pointer-events: none;
      width: 90%; max-width: 560px;
    }

    .spirit-comm-box {
      display: flex;
      align-items: flex-start;
      gap: 0;
      pointer-events: auto;
      cursor: pointer;
      animation: commSlideIn .25s ease-out;
      opacity: 0;
      animation-fill-mode: forwards;
    }
    @keyframes commSlideIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes commFadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-8px); }
    }

    .spirit-comm-portrait {
      width: 72px; height: 72px;
      min-width: 72px;
      border: 3px solid #888;
      background: #111;
      position: relative;
      overflow: hidden;
    }
    .spirit-comm-portrait img {
      width: 100%; height: 100%;
      object-fit: cover;
      filter: brightness(0.85) contrast(1.1);
    }
    /* Scanline on portrait */
    .spirit-comm-portrait::after {
      content: '';
      position: absolute; inset: 0;
      background: repeating-linear-gradient(
        0deg, transparent 0px, transparent 2px,
        rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px
      );
      pointer-events: none;
    }

    /* Health bar */
    .spirit-comm-hbar {
      position: absolute;
      top: 2px; left: 2px;
      width: calc(100% - 4px);
      height: 6px;
      display: flex; gap: 1px;
      z-index: 2;
    }
    .spirit-comm-hbar span {
      flex: 1; height: 100%;
      border: 1px solid rgba(0,0,0,.5);
    }
    .hb-g { background: #3f3; }
    .hb-y { background: #ff3; }
    .hb-r { background: #f33; }
    .hb-e { background: #222; }

    .spirit-comm-body {
      background: rgba(8, 12, 32, 0.94);
      border: 3px solid #888;
      border-left: none;
      padding: 8px 12px 10px 12px;
      min-height: 72px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      position: relative;
      flex: 1;
    }
    /* Scanline on body */
    .spirit-comm-body::after {
      content: '';
      position: absolute; inset: 0;
      background: repeating-linear-gradient(
        0deg, transparent 0px, transparent 2px,
        rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px
      );
      pointer-events: none;
    }

    .spirit-comm-name {
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .spirit-comm-text {
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      color: #e8e8e8;
      line-height: 1.6;
      text-shadow: 1px 1px 0 #000;
      min-height: 28px;
    }
    .spirit-comm-cursor {
      display: inline-block;
      width: 7px; height: 11px;
      background: #e8e8e8;
      animation: commBlink .5s step-end infinite;
      vertical-align: middle;
      margin-left: 2px;
    }
    @keyframes commBlink { 50% { opacity: 0; } }

    .spirit-comm-dismiss {
      font-family: 'Press Start 2P', monospace;
      font-size: 7px;
      color: #555;
      margin-top: 4px;
    }

    /* Quest area inside comm */
    .spirit-comm-quest-area {
      margin-top: 8px;
      position: relative;
      z-index: 2;
      pointer-events: auto;
    }

    /* CRT vignette just on the comm box */
    .spirit-comm-box::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%);
      pointer-events: none;
      z-index: 3;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'spiritCommOverlay';
  document.body.appendChild(overlay);
}

// ═══════ BUILD HEALTH BAR ═══════
function commBuildHealthBar(hp, maxHp) {
  const segments = 8;
  const ratio = hp / maxHp;
  const filled = Math.round(ratio * segments);
  let html = '<div class="spirit-comm-hbar">';
  for (let i = 0; i < segments; i++) {
    if (i < filled) {
      html += `<span class="${ratio > 0.5 ? 'hb-g' : ratio > 0.25 ? 'hb-y' : 'hb-r'}"></span>`;
    } else {
      html += '<span class="hb-e"></span>';
    }
  }
  return html + '</div>';
}

// ═══════ MAIN API ═══════

/**
 * showComm — Show a Star Fox-style comm box
 * @param {string} name       — Speaker name (NPC name or custom)
 * @param {string} text       — Dialogue text
 * @param {object} opts       — Options:
 *   art:      string  — custom art path (auto-resolved from NPC_COMM_PORTRAITS if omitted)
 *   color:    string  — name color (auto-resolved if omitted)
 *   hp:       number  — current HP for health bar (default: maxHp)
 *   maxHp:    number  — max HP (default: 6)
 *   side:     string  — 'left' or 'right' (default: 'left')
 *   speed:    number  — ms per character (default: 30)
 *   duration: number  — ms to stay after typing finishes (default: auto based on text length)
 *   persist:  boolean — if true, stays until clicked (default: false)
 *   questArea: boolean — if true, renders quest area inside (default: false)
 *   npcName:  string  — the NPC name for quest rendering (defaults to name)
 *   onDismiss: function — callback when dismissed
 */
function showComm(name, text, opts = {}) {
  ensureCommOverlay();
  commInitAudio();

  // Resolve portrait data
  const portraitData = NPC_COMM_PORTRAITS[name] || NPC_COMM_PORTRAITS['System'];
  const art = opts.art || portraitData.art;
  const color = opts.color || portraitData.color;
  const maxHp = opts.maxHp || 6;
  const hp = opts.hp !== undefined ? opts.hp : maxHp;
  const speed = opts.speed || 30;
  const persist = opts.persist || false;
  const questArea = opts.questArea || false;
  const npcName = opts.npcName || name;

  commQueue.push({ name, text, art, color, hp, maxHp, speed, persist, questArea, npcName, onDismiss: opts.onDismiss });
  if (!commTyping) processCommQueue();
}

/**
 * showCommSequence — Show multiple comm boxes in sequence (for cutscenes)
 * @param {Array} lines — Array of { name, text, ...opts }
 * @param {function} onComplete — callback when all done
 */
function showCommSequence(lines, onComplete) {
  if (!lines || lines.length === 0) { if (onComplete) onComplete(); return; }

  let idx = 0;
  function showNext() {
    if (idx >= lines.length) {
      if (onComplete) onComplete();
      return;
    }
    const line = lines[idx++];
    showComm(line.name, line.text, {
      ...line,
      persist: true,
      onDismiss: showNext,
    });
  }
  showNext();
}

function processCommQueue() {
  if (commQueue.length === 0) { commTyping = false; return; }
  commTyping = true;

  const msg = commQueue.shift();
  const overlay = document.getElementById('spiritCommOverlay');

  // Clear previous
  overlay.innerHTML = '';

  commPlayBlip();

  // Build comm box
  const box = document.createElement('div');
  box.className = 'spirit-comm-box';
  box.style.position = 'relative';

  // Portrait
  const portrait = document.createElement('div');
  portrait.className = 'spirit-comm-portrait';
  portrait.innerHTML = `<img src="${msg.art}" alt="${msg.name}">${commBuildHealthBar(msg.hp, msg.maxHp)}`;

  // Body
  const body = document.createElement('div');
  body.className = 'spirit-comm-body';

  const nameEl = document.createElement('div');
  nameEl.className = 'spirit-comm-name';
  nameEl.style.color = msg.color;
  nameEl.style.textShadow = `1px 1px 0 #000, 0 0 8px ${msg.color}`;
  nameEl.textContent = msg.name;

  const textEl = document.createElement('div');
  textEl.className = 'spirit-comm-text';

  const dismissEl = document.createElement('div');
  dismissEl.className = 'spirit-comm-dismiss';
  dismissEl.textContent = msg.questArea ? '' : 'click to dismiss';

  body.appendChild(nameEl);
  body.appendChild(textEl);

  // Quest area container
  let questContainer = null;
  if (msg.questArea) {
    questContainer = document.createElement('div');
    questContainer.className = 'spirit-comm-quest-area';
    questContainer.id = 'dialogueQuestArea';
    body.appendChild(questContainer);
  }

  body.appendChild(dismissEl);

  box.appendChild(portrait);
  box.appendChild(body);
  overlay.appendChild(box);

  // Click to dismiss
  function dismiss(e) {
    // Don't dismiss if clicking quest area buttons
    if (e && e.target.closest && e.target.closest('.spirit-comm-quest-area')) return;
    if (commTypeTimer) { clearTimeout(commTypeTimer); commTypeTimer = null; }
    box.style.animation = 'commFadeOut .2s ease forwards';
    setTimeout(() => {
      overlay.innerHTML = '';
      if (msg.onDismiss) msg.onDismiss();
      else processCommQueue();
    }, 200);
  }
  box.addEventListener('click', dismiss);

  // Typewriter effect
  const cursor = document.createElement('span');
  cursor.className = 'spirit-comm-cursor';
  textEl.appendChild(cursor);

  let charIdx = 0;
  function typeNext() {
    if (charIdx >= msg.text.length) {
      // Done typing
      cursor.remove();

      // Render quest area if needed
      if (msg.questArea && typeof renderQuestAreaInDialogue === 'function') {
        renderQuestAreaInDialogue(msg.npcName);
      }

      if (!msg.persist) {
        const dur = msg.duration || Math.max(2000, msg.text.length * 50);
        commTypeTimer = setTimeout(() => dismiss(null), dur);
      }
      return;
    }

    const span = document.createElement('span');
    span.textContent = msg.text[charIdx];
    textEl.insertBefore(span, cursor);
    if (charIdx % 2 === 0) commPlayTypeBlip();
    charIdx++;
    commTypeTimer = setTimeout(typeNext, msg.speed);
  }
  typeNext();
}

/**
 * closeComm — Force close any open comm box
 */
function closeComm() {
  if (commTypeTimer) { clearTimeout(commTypeTimer); commTypeTimer = null; }
  commQueue = [];
  commTyping = false;
  const overlay = document.getElementById('spiritCommOverlay');
  if (overlay) overlay.innerHTML = '';
}

// ═══════ OVERRIDE OLD DIALOGUE SYSTEM ═══════

// Replace showDialogue to use comms
const _originalShowDialogue = typeof showDialogue === 'function' ? showDialogue : null;

function showDialogue(npcName) {
  const data = NPC_DIALOGUE_MAP[npcName];
  if (!data) return;

  const line = data.getLine();

  // Show comm box with quest area
  showComm(npcName, line, {
    persist: true,
    questArea: true,
    npcName: npcName,
  });

  // Still show speech bubble on overworld
  const npc = NPCS.find(n => n.name === npcName);
  if (npc) showNPCSpeechBubble(npc, line);
}

// Replace closeDialogue
function closeDialogue() {
  closeComm();
  // Also hide old overlay in case anything still triggers it
  const old = document.getElementById('dialogueOverlay');
  if (old) old.classList.remove('active');
}

// Replace showMaskQuestDialogue with comm sequence
const _originalShowMaskQuestDialogue = typeof showMaskQuestDialogue === 'function' ? showMaskQuestDialogue : null;

function showMaskQuestDialogue(lines, onComplete) {
  // Convert plain text lines into comm sequence with Maren as speaker
  const commLines = lines.map((text, i) => ({
    name: i === 0 ? 'Maren' : (text.includes('Leon') || text.includes('camp') ? 'Leon' : 'Maren'),
    text: text,
    persist: true,
  }));
  showCommSequence(commLines, onComplete);
}

// ═══════ HOOK INTO HOSTILE NPC DIALOGUE ═══════
// Override the defeated-hostile-NPC dialogue in tryInteract
// This is done by patching after load — the hostile NPC friendly dialogue
// uses the old overlay directly in index.html tryInteract()
// We patch it via a global flag that tryInteract can check

function showHostileNPCComm(hnpc) {
  const line = hnpc.dialogue[Math.floor(Math.random() * hnpc.dialogue.length)];
  showComm(hnpc.name, line, { persist: true });
  showNPCSpeechBubble(hnpc, line);
}

// ═══════ CANTINA & INN MODULE OVERRIDES ═══════

// Override cantina dialogue to use Spirit Comms
const _origShowCantinaDialogue = typeof showCantinaDialogue === 'function' ? showCantinaDialogue : null;
function showCantinaDialogue(name, text, color) {
  // Still set the state flags so the module knows dialogue is active
  cantinaDialogueActive = true;
  cantinaDialogueData = { name, text, color: color || '#daa520' };
  // Route through Spirit Comms
  showComm(name, text, { color: color, persist: true, onDismiss: () => { closeCantinaDialogue(); } });
}

// Override inn dialogue to use Spirit Comms
const _origShowInnDialogue = typeof showInnDialogue === 'function' ? showInnDialogue : null;
function showInnDialogue(name, text, color) {
  innDialogueActive = true;
  innDialogueData = { name, text, color: color || '#d4956a' };
  showComm(name, text, { color: color, persist: true, onDismiss: () => { closeInnDialogue(); } });
}

// Override workshop dialogue
const _origShowWorkshopDialogue = typeof showWorkshopDialogue === 'function' ? showWorkshopDialogue : null;
function showWorkshopDialogue(name, text, color) {
  workshopDialogueActive = true;
  workshopDialogueData = { name, text, color: color || '#cc6633' };
  showComm(name, text, { color: color, persist: true, onDismiss: () => { closeWorkshopDialogue(); } });
}

// Override arena dialogue
const _origShowArenaDialogue = typeof showArenaDialogue === 'function' ? showArenaDialogue : null;
function showArenaDialogue(name, text, color) {
  arenaDialogueActive = true;
  arenaDialogueData = { name, text, color: color || '#cc4444' };
  showComm(name, text, { color: color, persist: true, onDismiss: () => { closeArenaDialogue(); } });
}

// Override castle dialogue
const _origShowCastleDialogue = typeof showCastleDialogue === 'function' ? showCastleDialogue : null;
function showCastleDialogue(name, text, color) {
  castleDialogueActive = true;
  castleDialogueData = { name, text, color: color || '#8040c0' };
  showComm(name, text, { color: color, persist: true, onDismiss: () => { closeCastleDialogue(); } });
}

// Override trading post dialogue
const _origShowTradingPostDialogue = typeof showTradingPostDialogue === 'function' ? showTradingPostDialogue : null;
function showTradingPostDialogue(name, text, color) {
  tradingPostDialogueActive = true;
  tradingPostDialogueData = { name, text, color: color || '#b8860b' };
  showComm(name, text, { color: color, persist: true, onDismiss: () => { closeTradingPostDialogue(); } });
}

// Override house dialogue
const _origShowHouseDialogue = typeof showHouseDialogue === 'function' ? showHouseDialogue : null;
function showHouseDialogue(name, text, color) {
  houseDialogueActive = true;
  houseDialogueData = { name, text, color: color || '#8899cc' };
  showComm(name, text, { color: color, persist: true, onDismiss: () => { closeHouseDialogue(); } });
}
