/* ═══════════════════════════════════════════════════════════════
   BATTLE DICE 3D — Physics-based CSS 3D dice rolling
   Ported from testroom's proven system.

   Self-contained: injects own CSS, creates own DOM overlay.
   Sits ON TOP of the Phaser canvas in the center dice area.

   API:
     Dice3D.init()                          — create arena overlay
     Dice3D.showRolling(team, count)        — launch physics dice
     Dice3D.revealDice(team, values, cb)    — settle to final values
     Dice3D.highlightWin(team, rollResult)  — glow winning dice
     Dice3D.highlightLose(team)             — dim losing dice
     Dice3D.clear(team)                     — remove dice for a team
     Dice3D.destroy()                       — full cleanup
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── PIP LAYOUTS ──────────────────────────────────────────
  const PIP_LAYOUTS = {
    1: ['c'],
    2: ['tr','bl'],
    3: ['tr','c','bl'],
    4: ['tl','tr','bl','br'],
    5: ['tl','tr','c','bl','br'],
    6: ['tl','ml','bl','tr','mr','br']
  };
  const PIP_STYLES = {
    tl:'top:18%;left:18%', tr:'top:18%;right:18%',
    ml:'top:50%;left:18%;transform:translateY(-50%)',
    c:'top:50%;left:50%;transform:translate(-50%,-50%)',
    mr:'top:50%;right:18%;transform:translateY(-50%)',
    bl:'bottom:18%;left:18%', br:'bottom:18%;right:18%'
  };

  // ── FACE TARGETS (value → rotation) ──────────────────────
  // front=1, right=2, top=3, bottom=4, left=5, back=6
  const FACE_TARGET = {
    1:{rx:0,ry:0}, 2:{rx:0,ry:-90}, 3:{rx:90,ry:0},
    4:{rx:-90,ry:0}, 5:{rx:0,ry:90}, 6:{rx:0,ry:180}
  };

  function nearestSnap(cur, tgt) {
    const n = Math.round((cur - tgt) / 360);
    return tgt + n * 360;
  }

  // ── HTML GENERATION ──────────────────────────────────────
  function pip3dHTML(val) {
    return (PIP_LAYOUTS[val] || PIP_LAYOUTS[1])
      .map(p => `<span class="pip3d" style="${PIP_STYLES[p]}"></span>`).join('');
  }

  function cube3dHTML(team) {
    const c = 'face-' + team;
    return [
      ['front',1],['back',6],['right',2],['left',5],['top',3],['bottom',4]
    ].map(([f,v]) => `<div class="die-face ${c} face-${f}">${pip3dHTML(v)}</div>`).join('');
  }

  // ── THROW PROFILES ───────────────────────────────────────
  const THROW_PROFILES = [
    // THE BLOOM
    (i, n) => { const t = n > 1 ? i/(n-1) : 0.5; return { vx: 13+t*15, vy: -(25-t*20) }; },
    // THE BANK SHOT
    (i, n) => { const t = n > 1 ? i/(n-1) : 0.5; return { vx: 10+t*14, vy: -(20+t*4) }; },
    // THE CROSS-TABLE
    (i, n) => { const t = n > 1 ? i/(n-1) : 0.5; return { vx: 24+t*6, vy: -(8+t*10) }; },
    // THE SPIRAL
    (i, n) => { const t = n > 1 ? i/(n-1) : 0.5; return { vx: 28-t*18, vy: -(10+t*12) }; },
    // THE SCATTER
    (i, n) => { const angles = [0.15, 0.55, 0.85, 0.35, 0.7]; const a = angles[i%angles.length]; return { vx: 14+a*14, vy: -(6+(1-a)*20) }; },
    // THE GENTLE TOSS
    (i, n) => { const t = n > 1 ? i/(n-1) : 0.5; return { vx: 7+t*5, vy: -(9+t*3) }; },
  ];

  function pickThrowProfile(count) {
    const profile = THROW_PROFILES[Math.floor(Math.random() * THROW_PROFILES.length)];
    const noise = () => 1 + (Math.random() - 0.5) * 0.25;
    return Array.from({ length: count }, (_, i) => {
      const v = profile(i, count);
      return { vx: v.vx * noise() * 1.15, vy: v.vy * noise() * 1.15 };
    });
  }

  // ── STATE ────────────────────────────────────────────────
  let _arena = null;
  let _physics = {};
  let _cssInjected = false;

  // ── CSS INJECTION ────────────────────────────────────────
  function injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    const style = document.createElement('style');
    style.id = 'dice3dCSS';
    style.textContent = `
      /* ── 3D Dice Arena Overlay ── */
      #dice3d-arena {
        position: absolute;
        top: 15%;
        left: 25%;
        width: 50%;
        height: 50%;
        z-index: 50;
        pointer-events: none;
        overflow: hidden;
      }
      /* ── Physics Die Container ── */
      .die-physics {
        position: absolute;
        z-index: 10;
        perspective: 350px;
        pointer-events: none;
      }
      .die-cube {
        width: 100%; height: 100%;
        position: relative;
        transform-style: preserve-3d;
      }
      .die-face {
        position: absolute;
        width: 100%; height: 100%;
        border-radius: 11px;
        box-sizing: border-box;
        backface-visibility: hidden;
        background: linear-gradient(165deg, #f4ecd8 0%, #e8dcb8 35%, #d8c894 70%, #b8a878 100%);
        border: 1px solid rgba(120,80,30,0.5);
        box-shadow: inset 0 -2px 4px rgba(120,80,30,0.25), inset 0 1px 2px rgba(255,255,240,0.5);
      }
      .die-face.face-red {
        border-color: rgba(233,69,96,0.55);
        background: linear-gradient(165deg, #fce0d8 0%, #f4b8a8 35%, #d88878 70%, #a05050 100%);
      }
      .die-face.face-blue {
        border-color: rgba(76,201,240,0.55);
        background: linear-gradient(165deg, #dcf0fc 0%, #a8d8ee 35%, #78a0c4 70%, #406088 100%);
      }
      /* Cube face transforms */
      .face-front  { transform: translateZ(var(--dh, 28px)); }
      .face-back   { transform: rotateY(180deg) translateZ(var(--dh, 28px)); }
      .face-right  { transform: rotateY(90deg) translateZ(var(--dh, 28px)); }
      .face-left   { transform: rotateY(-90deg) translateZ(var(--dh, 28px)); }
      .face-top    { transform: rotateX(-90deg) translateZ(var(--dh, 28px)); }
      .face-bottom { transform: rotateX(90deg) translateZ(var(--dh, 28px)); }
      /* Pips */
      .pip3d {
        position: absolute;
        width: 9px; height: 9px;
        border-radius: 50%;
        background: #3a1f08;
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.3);
      }
      .face-red .pip3d { background: #4a0e1a; }
      .face-blue .pip3d { background: #0a3050; }
      /* Settling transitions */
      .die-physics.settling .die-cube {
        transition: transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
      }
      .die-physics.settling {
        transition: left 0.7s cubic-bezier(0.25, 1.1, 0.5, 1),
                    top 0.7s cubic-bezier(0.25, 1.1, 0.5, 1);
      }
      /* Shadow beneath dice */
      .die-physics::after {
        content: '';
        position: absolute;
        bottom: -6px; left: 8%;
        width: 84%; height: 10px;
        background: radial-gradient(ellipse, rgba(0,0,0,0.35), transparent 70%);
        border-radius: 50%;
        pointer-events: none;
      }
      /* ── Win/Lose Highlights ── */
      .die-physics.die-win-singles-3d {
        transform: scale(1.12);
        filter: drop-shadow(0 0 12px rgba(255,200,60,0.8)) drop-shadow(0 0 24px rgba(255,175,35,0.4));
        animation: dieWin3dPulse 1.3s ease-in-out infinite;
      }
      .die-physics.die-win-singles-3d .die-face {
        border-color: #ffc83a !important;
        background: linear-gradient(165deg, #fff6cc 0%, #ffe27a 35%, #ffc83a 70%, #d79418 100%) !important;
      }
      .die-physics.die-win-singles-3d .pip3d { background: #5a2a08 !important; }
      .die-physics.die-win-doubles-3d {
        transform: scale(1.18);
        filter: drop-shadow(0 0 16px rgba(255,205,70,0.95)) drop-shadow(0 0 36px rgba(255,180,45,0.55));
        animation: dieWin3dPulse 1.15s ease-in-out infinite;
      }
      .die-physics.die-win-doubles-3d .die-face {
        border-color: #ffd448 !important;
        background: linear-gradient(165deg, #fff6cc 0%, #ffe27a 35%, #ffc83a 70%, #d79418 100%) !important;
      }
      .die-physics.die-win-doubles-3d .pip3d { background: #5a2a08 !important; }
      .die-physics.die-win-triples-3d {
        transform: scale(1.24);
        filter: drop-shadow(0 0 20px rgba(255,210,80,1)) drop-shadow(0 0 48px rgba(255,185,50,0.65));
        animation: dieWin3dTriples 0.95s ease-in-out infinite;
      }
      .die-physics.die-win-triples-3d .die-face {
        border-color: #fff3a0 !important;
        background: linear-gradient(165deg, #fffadd 0%, #fff08a 30%, #ffd448 65%, #e39918 100%) !important;
      }
      .die-physics.die-win-triples-3d .pip3d { background: #4a1d02 !important; }
      .die-physics.die-win-mega-3d {
        transform: scale(1.32);
        filter: drop-shadow(0 0 26px rgba(255,215,85,1)) drop-shadow(0 0 60px rgba(255,190,50,0.8));
        animation: dieWin3dMega 0.85s ease-in-out infinite;
      }
      .die-physics.die-win-mega-3d .die-face {
        border-color: #fff7b0 !important;
        background: linear-gradient(165deg, #fffadd 0%, #fff08a 25%, #ffd448 55%, #e39918 85%) !important;
      }
      .die-physics.die-win-mega-3d .pip3d { background: #3a1d02 !important; }
      .die-physics.die-loser-3d {
        opacity: 0.42;
        transform: scale(0.92);
        filter: brightness(0.65) saturate(0.6);
        transition: opacity 0.4s, transform 0.4s, filter 0.4s;
      }
      @keyframes dieWin3dPulse {
        0%,100% { filter: drop-shadow(0 0 12px rgba(255,200,60,0.8)) drop-shadow(0 0 24px rgba(255,175,35,0.4)); }
        50%     { filter: drop-shadow(0 0 18px rgba(255,210,80,1)) drop-shadow(0 0 36px rgba(255,185,50,0.6)); }
      }
      @keyframes dieWin3dTriples {
        0%,100% { filter: drop-shadow(0 0 20px rgba(255,210,80,1)) drop-shadow(0 0 48px rgba(255,185,50,0.65)); }
        50%     { filter: drop-shadow(0 0 28px rgba(255,220,100,1)) drop-shadow(0 0 60px rgba(255,195,60,0.8)); }
      }
      @keyframes dieWin3dMega {
        0%,100% { filter: drop-shadow(0 0 26px rgba(255,215,85,1)) drop-shadow(0 0 60px rgba(255,190,50,0.8)); }
        50%     { filter: drop-shadow(0 0 35px rgba(255,225,100,1)) drop-shadow(0 0 75px rgba(255,200,65,0.95)); }
      }
    `;
    document.head.appendChild(style);
  }

  // ── ARENA CREATION ───────────────────────────────────────
  function ensureArena() {
    if (_arena) return _arena;
    injectCSS();
    _arena = document.createElement('div');
    _arena.id = 'dice3d-arena';
    const container = document.getElementById('game-container') || document.body;
    container.appendChild(_arena);
    return _arena;
  }

  // ── PHYSICS ENGINE ───────────────────────────────────────
  function getBounceCoeff(d) {
    return Math.max(0.3, 0.65 * Math.pow(0.8, d.bounceCount));
  }
  function getSurfaceFriction(speed) {
    if (speed > 8) return 0.982;
    if (speed > 3) return 0.965;
    return 0.935;
  }
  function getRotFriction(speed) {
    if (speed > 8) return 0.972;
    if (speed > 3) return 0.950;
    return 0.920;
  }

  // ── PUBLIC API ───────────────────────────────────────────

  function init() {
    ensureArena();
  }

  function showRolling(team, count) {
    const arena = ensureArena();
    if (count === 0) return;

    // Clean up previous
    if (_physics[team]) {
      cancelAnimationFrame(_physics[team].raf);
      _physics[team].els.forEach(e => e.remove());
    }

    const W = arena.offsetWidth;
    const H = arena.offsetHeight;
    const dieSize = 56;
    const half = dieSize / 2;
    const pad = 10;
    const minX = pad, maxX = W - pad - dieSize;
    const minY = pad, maxY = H - pad - dieSize;

    const dice = [];
    const els = [];
    const isRed = team === 'red' || team === 'player';
    const handX = isRed ? minX + 10 : maxX - 10;
    const handY = maxY - 5;
    const throwVecs = pickThrowProfile(count);

    for (let i = 0; i < count; i++) {
      const die = document.createElement('div');
      die.className = 'die-physics';
      die.style.width = dieSize + 'px';
      die.style.height = dieSize + 'px';
      die.style.zIndex = '100';
      die.style.setProperty('--dh', half + 'px');
      die.innerHTML = `<div class="die-cube">${cube3dHTML(isRed ? 'red' : 'blue')}</div>`;
      arena.appendChild(die);
      els.push(die);

      const tv = throwVecs[i];
      dice.push({
        el: die, cube: die.querySelector('.die-cube'),
        x: handX + (Math.random() - 0.5) * 6,
        y: handY + (Math.random() - 0.5) * 6,
        vx: (isRed ? 1 : -1) * tv.vx,
        vy: tv.vy,
        rx: Math.random() * 720, ry: Math.random() * 720, rz: Math.random() * 360,
        vrx: (Math.random() - 0.5) * 55,
        vry: (Math.random() - 0.5) * 55,
        vrz: (Math.random() - 0.5) * 40,
        bounceCount: 0,
        value: 0,
      });
    }

    function step() {
      // Dice-to-dice repulsion
      for (let a = 0; a < dice.length; a++) {
        for (let b = a + 1; b < dice.length; b++) {
          const da = dice[a], db = dice[b];
          const dx = da.x - db.x, dy = da.y - db.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < dieSize && dist > 0.1) {
            const push = (dieSize - dist) * 0.15;
            const nx = dx / dist, ny = dy / dist;
            da.vx += nx * push; da.vy += ny * push;
            db.vx -= nx * push; db.vy -= ny * push;
          }
        }
      }

      dice.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        d.rx += d.vrx; d.ry += d.vry; d.rz += d.vrz;
        const speed = Math.abs(d.vx) + Math.abs(d.vy);

        const bc = getBounceCoeff(d);
        if (d.x < minX) { d.x = minX; d.vx = Math.abs(d.vx) * bc; d.vry *= 1.4; d.vrz *= 1.3; d.bounceCount++; }
        if (d.x > maxX) { d.x = maxX; d.vx = -Math.abs(d.vx) * bc; d.vry *= 1.4; d.vrz *= 1.3; d.bounceCount++; }
        if (d.y < minY) { d.y = minY; d.vy = Math.abs(d.vy) * bc; d.vrx *= 1.4; d.vrz *= 1.3; d.bounceCount++; }
        if (d.y > maxY) { d.y = maxY; d.vy = -Math.abs(d.vy) * bc; d.vrx *= 1.4; d.vrz *= 1.3; d.bounceCount++; }

        const fric = getSurfaceFriction(speed);
        const rFric = getRotFriction(speed);
        d.vx *= fric; d.vy *= fric;
        d.vrx *= rFric; d.vry *= rFric; d.vrz *= rFric;

        // Rotation homing — settle onto nearest face
        if (speed < 6) {
          const strength = 0.08 * (1 - speed / 6);
          d.rx += (Math.round(d.rx / 90) * 90 - d.rx) * strength;
          d.ry += (Math.round(d.ry / 90) * 90 - d.ry) * strength;
          d.rz += (Math.round(d.rz / 90) * 90 - d.rz) * strength;
        }

        d.el.style.left = d.x + 'px';
        d.el.style.top = d.y + 'px';
        d.cube.style.transform = `rotateX(${d.rx}deg) rotateY(${d.ry}deg) rotateZ(${d.rz}deg)`;
      });

      _physics[team].raf = requestAnimationFrame(step);
    }

    _physics[team] = { raf: requestAnimationFrame(step), dice, els, settled: false, values: [] };
  }

  function revealDice(team, values, onComplete) {
    const physics = _physics[team];
    if (!physics || !physics.dice.length) {
      if (onComplete) onComplete();
      return;
    }

    cancelAnimationFrame(physics.raf);

    const arena = ensureArena();
    const W = arena.offsetWidth;
    const H = arena.offsetHeight;
    const dieSize = 56;
    const gap = 16;
    const isRed = team === 'red' || team === 'player';

    // Settle positions: player dice on left half, enemy on right
    const totalW = values.length * dieSize + (values.length - 1) * gap;
    const centerX = isRed ? W * 0.28 : W * 0.72;
    const startX = centerX - totalW / 2;
    const trayY = H * 0.45;

    values.forEach((v, i) => {
      const d = physics.dice[i];
      if (!d) return;

      const tx = startX + i * (dieSize + gap);
      const ty = trayY;
      const tgt = FACE_TARGET[v];
      const frx = nearestSnap(d.rx, tgt.rx);
      const fry = nearestSnap(d.ry, tgt.ry);
      const frz = nearestSnap(d.rz, 0);
      d.rx = frx; d.ry = fry; d.rz = frz;
      d.value = v;

      setTimeout(() => {
        d.el.classList.add('settling');
        d.el.style.left = tx + 'px';
        d.el.style.top = ty + 'px';
        d.cube.style.transform = `rotateX(${frx}deg) rotateY(${fry}deg) rotateZ(${frz}deg)`;
      }, i * 80);
    });

    const settleDelay = values.length * 80 + 750;
    setTimeout(() => {
      physics.settled = true;
      physics.values = values;
      physics.els.forEach(e => e.style.zIndex = '10');
      if (onComplete) onComplete();
    }, settleDelay);
  }

  function highlightWin(team, rollResult) {
    const physics = _physics[team];
    if (!physics || !physics.settled) return;

    const type = rollResult.type;
    const value = rollResult.value;

    physics.dice.forEach(d => {
      // Clear previous highlights
      d.el.className = 'die-physics settling';

      if (d.value === value) {
        if (type === 'singles') d.el.classList.add('die-win-singles-3d');
        else if (type === 'doubles') d.el.classList.add('die-win-doubles-3d');
        else if (type === 'triples') d.el.classList.add('die-win-triples-3d');
        else d.el.classList.add('die-win-mega-3d'); // quads, penta, N-of-a-kind
      }
    });
  }

  function highlightLose(team) {
    const physics = _physics[team];
    if (!physics || !physics.settled) return;
    physics.dice.forEach(d => {
      d.el.classList.add('die-loser-3d');
    });
  }

  function clear(team) {
    if (_physics[team]) {
      cancelAnimationFrame(_physics[team].raf);
      _physics[team].els.forEach(e => e.remove());
      delete _physics[team];
    }
  }

  function destroy() {
    clear('red');
    clear('blue');
    clear('player');
    clear('enemy');
    if (_arena) {
      _arena.remove();
      _arena = null;
    }
  }

  // ── EXPOSE GLOBALLY ──────────────────────────────────────
  window.Dice3D = { init, showRolling, revealDice, highlightWin, highlightLose, clear, destroy };
})();
