/* ═══════════════════════════════════════════════════
   STAR FOX 64 COMM ENGINE — Battle of Origins
   Portable module: works in online/, world/, or standalone.

   Usage:
     StarfoxComm.playOne('valkin', 'Kneel before me.');
     StarfoxComm.play([
       { char: 'valkin', text: 'Your end approaches.' },
       { char: 'elderFrost', text: 'We will not yield!' }
     ], { warning: '★ BOSS FIGHT ★', dark: true });
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Resolve art paths ──
  const ART = p => `../testroom/art/originals/${p}.png`;
  const ART_OLD = p => `../testroom/art/${p}`;

  // ── Inject DOM elements if not present ──
  function ensureDOM() {
    if (document.getElementById('sfCommBox')) return;

    const html = `
      <div class="sf-scanlines" id="sfScanlines"></div>
      <div class="sf-alert-flash" id="sfAlertFlash"></div>
      <div class="sf-warning-banner" id="sfWarningBanner"></div>
      <div class="sf-comm-box" id="sfCommBox">
        <div class="sf-portrait-cell" id="sfPortraitCell">
          <img id="sfPortraitImg" src="" alt="">
          <div class="sf-hp-bar-wrap">
            <div class="sf-hp-bar-fill" id="sfHpBar"></div>
          </div>
        </div>
        <div class="sf-comm-content">
          <div class="sf-comm-name" id="sfCommName"></div>
          <div class="sf-comm-dialogue" id="sfCommDialogue"></div>
        </div>
        <div class="sf-comm-advance" id="sfCommAdvance">&#9660;</div>
      </div>
      <div class="sf-queue-bar" id="sfQueueBar"></div>`;

    const container = document.createElement('div');
    container.id = 'sfCommRoot';
    container.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
    container.innerHTML = html;
    document.body.appendChild(container);
    // Ensure interactive elements receive clicks
    const box = container.querySelector('.sf-comm-box');
    if (box) box.style.pointerEvents = 'auto';
  }

  // ── Audio synthesis ──
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playBlip(freq = 440, dur = 0.025) {
    const ctx = getAudio();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq + (Math.random() * 50 - 25);
    gain.gain.value = 0.035;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  function playAlertChime() {
    const ctx = getAudio();
    [0, 80, 160].forEach((d, i) => setTimeout(() => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = [330, 440, 660][i];
      g.gain.value = 0.05; g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.1);
    }, d));
  }

  function playDarkChime() {
    const ctx = getAudio();
    [0, 120, 240, 400].forEach((d, i) => setTimeout(() => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = [220, 185, 147, 110][i];
      g.gain.value = 0.04; g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2);
    }, d));
  }

  // ── Characters ──
  const CHARACTERS = {
    valkin:       { name: 'Valkin',        color: '#aa44ff', art: ART('ValkinTheGrand'), hp: 30, blipFreq: 160, blipSpeed: 40 },
    elderFrost:   { name: 'Elder Frost',   color: '#daa520', art: ART('Cornelius'),      hp: 6,  blipFreq: 380, blipSpeed: 28 },
    crazyLou:     { name: 'Crazy Lou',     color: '#c0a040', art: ART('Katrina'),        hp: 5,  blipFreq: 520, blipSpeed: 22 },
    darkFang:     { name: 'Dark Fang',     color: '#cc4444', art: ART('DarkFang'),       hp: 5,  blipFreq: 200, blipSpeed: 32 },
    flora:        { name: 'Flora',         color: '#6a8a4a', art: ART('Flora'),          hp: 4,  blipFreq: 600, blipSpeed: 20 },
    shade:        { name: '???',           color: '#6a6a8a', art: ART('Shade'),          hp: 5,  blipFreq: 140, blipSpeed: 50 },
    shadowWarden: { name: 'Shadow Warden', color: '#8a6aaa', art: ART('DarkWing'),       hp: 6,  blipFreq: 240, blipSpeed: 35 },
    vera:         { name: 'Vera',          color: '#6688cc', art: ART('Sonya'),          hp: 5,  blipFreq: 480, blipSpeed: 25 },
    gary:         { name: 'Ember',         color: '#ff6633', art: ART_OLD('gary.png'),   hp: 7,  blipFreq: 350, blipSpeed: 26 },
    hugo:         { name: 'Jax',           color: '#cc4444', art: ART('Hugo'),           hp: 7,  blipFreq: 190, blipSpeed: 30 },
    wanderer:     { name: 'The Exile',     color: '#888888', art: ART('Wanderer'),       hp: 4,  blipFreq: 280, blipSpeed: 40 },
    timber:       { name: 'Timber',        color: '#8ab060', art: ART_OLD('timber.jpg'), hp: 8,  blipFreq: 300, blipSpeed: 24 },
  };

  // ── State ──
  let currentScene = null;
  let lineIndex = 0;
  let typing = false;
  let typeTimer = null;
  let charIndex = 0;
  const seenChars = new Set();
  let onCompleteCallback = null;

  const $ = id => document.getElementById(id);

  // ── Queue pips ──
  function buildPips(n) {
    const b = $('sfQueueBar'); b.innerHTML = '';
    for (let i = 0; i < n; i++) { const p = document.createElement('div'); p.className = 'sf-queue-pip'; b.appendChild(p); }
  }
  function updatePips() {
    const pips = $('sfQueueBar').children;
    for (let i = 0; i < pips.length; i++)
      pips[i].className = 'sf-queue-pip' + (i === lineIndex ? ' active' : i < lineIndex ? ' done' : '');
  }

  function hpColor(pct) {
    return pct > 0.5 ? '#44cc44' : pct > 0.25 ? '#ccaa22' : '#cc3333';
  }

  // ── Warning ──
  function showWarning(text, dark) {
    const b = $('sfWarningBanner');
    b.textContent = text;
    b.className = 'sf-warning-banner show';
    if (dark) { b.style.color = '#aa44ff'; b.style.textShadow = '0 0 16px rgba(160,60,255,0.5)'; playDarkChime(); }
    else { b.style.color = ''; b.style.textShadow = ''; playAlertChime(); }
    const f = $('sfAlertFlash'); f.className = 'sf-alert-flash fire';
    setTimeout(() => f.className = 'sf-alert-flash', 400);
    setTimeout(() => b.className = 'sf-warning-banner', 1800);
  }

  // ── Show line ──
  function showLine() {
    if (!currentScene || lineIndex >= currentScene.lines.length) { closeComm(); return; }

    const line = currentScene.lines[lineIndex];
    const ch = CHARACTERS[line.char];
    if (!ch) { lineIndex++; showLine(); return; }

    updatePips();

    const cell = $('sfPortraitCell');
    $('sfPortraitImg').src = ch.art;
    $('sfCommName').textContent = ch.name;
    $('sfCommName').style.color = ch.color;

    // HP bar
    const maxHp = ch.hp || 8;
    const curHp = line.hp !== undefined ? line.hp : maxHp;
    const pct = curHp / maxHp;
    const hp = $('sfHpBar');
    hp.style.height = (pct * 100) + '%';
    hp.style.background = hpColor(pct);

    // Glitch only on first appearance per scene
    if (!seenChars.has(line.char)) {
      seenChars.add(line.char);
      cell.classList.remove('glitch');
      void cell.offsetWidth;
      cell.classList.add('glitch');
    } else {
      cell.classList.remove('glitch');
    }

    // Scanlines on while comm is open
    $('sfScanlines').classList.add('active');

    // Open
    $('sfCommBox').classList.add('open');

    // Type
    $('sfCommDialogue').innerHTML = '';
    $('sfCommAdvance').style.display = 'none';
    typing = true;
    charIndex = 0;
    typeNext(line.text, ch);
  }

  // ── Typewriter ──
  function typeNext(text, ch) {
    if (charIndex >= text.length) {
      typing = false;
      $('sfCommAdvance').style.display = 'block';
      const c = $('sfCommDialogue').querySelector('.sf-cursor');
      if (c) c.remove();
      return;
    }

    const c = text[charIndex];
    const dlg = $('sfCommDialogue');
    const span = dlg.querySelector('.sf-tc') || (() => {
      const s = document.createElement('span'); s.className = 'sf-tc'; dlg.appendChild(s);
      const cur = document.createElement('span'); cur.className = 'sf-cursor'; dlg.appendChild(cur);
      return s;
    })();

    span.textContent += c;
    charIndex++;

    if (c !== ' ' && c !== '.' && c !== ',' && c !== '—' && c !== '!') playBlip(ch.blipFreq);

    let delay = ch.blipSpeed;
    if ('.!?'.includes(c)) delay *= 5;
    else if (',;'.includes(c)) delay *= 2.5;
    else if (c === '—') delay *= 3;
    else if (c === ' ') delay *= 0.4;

    typeTimer = setTimeout(() => typeNext(text, ch), delay);
  }

  function finishTyping() {
    if (!typing || !currentScene) return;
    clearTimeout(typeTimer);
    $('sfCommDialogue').innerHTML = `<span class="sf-tc">${currentScene.lines[lineIndex].text}</span>`;
    typing = false;
    $('sfCommAdvance').style.display = 'block';
  }

  function advanceLine() {
    if (typing) { finishTyping(); return; }
    lineIndex++;
    if (lineIndex >= currentScene.lines.length) closeComm();
    else showLine();
  }

  function closeComm() {
    $('sfCommBox').classList.remove('open');
    $('sfScanlines').classList.remove('active');
    $('sfQueueBar').innerHTML = '';
    const cb = onCompleteCallback;
    currentScene = null; lineIndex = 0; onCompleteCallback = null;
    if (cb) cb();
  }

  // ── Input (only when comm is active) ──
  document.addEventListener('keydown', e => {
    if (!currentScene) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      advanceLine();
    }
    if (e.code === 'Escape') closeComm();
  });

  document.addEventListener('click', e => {
    if (!currentScene) return;
    // Don't capture clicks on game UI
    if (e.target.closest('.sf-comm-box') || e.target.closest('#sfCommRoot')) {
      advanceLine();
    }
  });

  // ── Init DOM on load ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDOM);
  } else {
    ensureDOM();
  }

  // ── Public API ──
  window.StarfoxComm = {
    CHARACTERS,

    /** Play a dialogue sequence. opts: { warning, dark, onComplete } */
    play(lines, opts = {}) {
      ensureDOM();
      seenChars.clear();
      onCompleteCallback = opts.onComplete || null;

      if (opts.warning) {
        showWarning(opts.warning, opts.dark);
        setTimeout(() => {
          currentScene = { lines };
          lineIndex = 0;
          buildPips(lines.length);
          showLine();
        }, 1400);
      } else {
        currentScene = { lines };
        lineIndex = 0;
        buildPips(lines.length);
        showLine();
      }
    },

    /** Play a single line */
    playOne(charKey, text, opts = {}) {
      this.play([{ char: charKey, text }], opts);
    },

    /** Register a custom character */
    addCharacter(key, prof) {
      CHARACTERS[key] = prof;
    },

    /** Check if comm is currently active */
    isActive() {
      return !!currentScene;
    },

    /** Force close */
    close() {
      closeComm();
    },

    /** Advance (for external buttons) */
    advance() {
      if (currentScene) advanceLine();
    }
  };

})();
