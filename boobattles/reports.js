// ══════════════════════════════════════════════════════════════════════════════
// REPORTS — Narration lines, Hall of Fame, run history
// ══════════════════════════════════════════════════════════════════════════════

// VS-aware narration helpers
const VS_TIE_LINES = [
  'Tie! Roll again!',
  'Matched! Reroll!',
  'Standoff! Again!',
  'Even! Roll again!',
];
const VS_WIN_LINES = [
  (w, l, d) => `<b class="gold">${d} damage</b> to ${l}!`,
  (w, l, d) => `${w} deals <b class="gold">${d} damage!</b>`,
  (w, l, d) => `<b class="gold">${d} damage!</b>&nbsp;${w} wins the round!`,
];
const VS_BIG_WIN_LINES = [
  (w, l, d) => `<b class="gold">${d} damage!</b>&nbsp;Huge hit by ${w}!`,
  (w, l, d) => `<b class="gold">${d} damage!</b>&nbsp;${w} crushes ${l}!`,
  (w, l, d) => `<b class="gold">${d} damage!</b>&nbsp;Devastating!`,
];
function vsNarrateDamage(winner, loser, damage) {
  if (damage >= 4) return VS_BIG_WIN_LINES[Math.floor(Math.random()*VS_BIG_WIN_LINES.length)](winner, loser, damage);
  return VS_WIN_LINES[Math.floor(Math.random()*VS_WIN_LINES.length)](winner, loser, damage);
}
function vsNarrateTie() { return VS_TIE_LINES[Math.floor(Math.random()*VS_TIE_LINES.length)]; }

const FAREWELL_LINES = [
  "Gone, but never forgotten.",
  "The spirit world calls them home.",
  "They fought bravely to the end.",
  "Their light fades into the mist.",
  "A true warrior. Rest now.",
  "The battle claimed another soul.",
  "They gave everything they had.",
  "Lost to the void between worlds.",
];

// ══════════════════════════════════════════════
// HALL OF FAME — persists across runs
// ══════════════════════════════════════════════
function getHallOfFame() {
  try { return JSON.parse(localStorage.getItem('boo_hall_of_fame')) || []; } catch { return []; }
}

function saveHallOfFame(hof) {
  localStorage.setItem('boo_hall_of_fame', JSON.stringify(hof));
}

function addToHallOfFame(ghostName, ghostFile, bossName, location) {
  const hof = getHallOfFame();
  // Prevent duplicate entries for same ghost beating same boss
  if (hof.some(e => e.ghost === ghostName && e.boss === bossName)) return;
  hof.push({ ghost: ghostName, file: ghostFile, boss: bossName, location: location || '', fallen: false });
  saveHallOfFame(hof);
}

function markFallenInHallOfFame(deadNames) {
  const hof = getHallOfFame();
  hof.forEach(entry => {
    if (deadNames.includes(entry.ghost)) entry.fallen = true;
  });
  saveHallOfFame(hof);
}

const FALLEN_QUOTES = [
  "I knew we could do it!",
  "Whoopie!!",
  "You did it...",
  "Yippie!",
  "Way to go, champ"
];

function showHallOfFame() {
  showScreen('hofScreen');
  const grid = document.getElementById('hofGrid');
  grid.innerHTML = '';
  const hof = getHallOfFame();

  if (hof.length === 0) {
    grid.innerHTML = '<div class="hof-empty">No champions yet. Beat the tournament to fill the Hall of Fame.</div>';
    return;
  }

  // Merge all entries into unique ghosts with combined defeated lists
  const ghostMap = {};
  hof.forEach(entry => {
    const key = entry.ghost;
    if (!ghostMap[key]) {
      ghostMap[key] = { ghost: entry.ghost, file: entry.file, defeated: [], fallen: false };
    }
    // New format: entry.defeated is an array
    if (entry.defeated && Array.isArray(entry.defeated)) {
      entry.defeated.forEach(b => {
        if (!ghostMap[key].defeated.includes(b)) ghostMap[key].defeated.push(b);
      });
    }
    // Old format: entry.boss is a single string
    else if (entry.boss && entry.boss !== 'Champion' && entry.boss !== 'Fallen') {
      if (!ghostMap[key].defeated.includes(entry.boss)) ghostMap[key].defeated.push(entry.boss);
    }
    if (entry.fallen) ghostMap[key].fallen = true;
    if (entry.killedBy) ghostMap[key].killedBy = entry.killedBy;
  });

  const entries = Object.values(ghostMap);
  // Sort: survivors first, then fallen
  entries.sort((a, b) => (a.fallen ? 1 : 0) - (b.fallen ? 1 : 0));

  // Shuffle quotes so no two fallen ghosts share one
  const shuffledQuotes = [...FALLEN_QUOTES].sort(() => Math.random() - 0.5);
  let quoteIdx = 0;

  // Slideshow: reveal entries one at a time
  let idx = 0;
  function showNext() {
    if (idx >= entries.length) return;
    const entry = entries[idx];
    const el = document.createElement('div');
    el.className = 'hof-entry' + (entry.fallen ? ' fallen' : '');
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px) scale(0.9)';
    el.style.transition = 'opacity 0.5s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';

    const defeatedText = entry.defeated.length > 0
      ? `<div class="hof-boss">Defeated: ${entry.defeated.join(', ')}</div>`
      : '';
    const fallenQuote = entry.fallen
      ? `<div class="hof-quote">"${shuffledQuotes[quoteIdx++ % shuffledQuotes.length]}"</div>`
      : '';

    el.innerHTML = `
      <div class="hof-card"><img src="${IMG}${entry.file}"></div>
      <div class="hof-info">
        <div class="hof-name">${entry.ghost}</div>
        ${defeatedText}
        ${entry.fallen ? `<div class="hof-fallen-tag">Defeated by ${entry.killedBy || 'unknown'}</div>` : ''}
        ${fallenQuote}
      </div>
    `;
    grid.appendChild(el);
    playSfx('sfxSpecial', 0.4);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });

    idx++;
    if (idx < entries.length) setTimeout(showNext, 800);
  }

  showNext();
}

function saveRunToHallOfFame(battleWins, deadNames, killedBy) {
  // Replace entire HoF with just this run — only ghosts that actually battled
  const hof = [];

  // Group wins by ghost
  const ghostWins = {};
  battleWins.forEach(w => {
    if (!ghostWins[w.ghost]) ghostWins[w.ghost] = { file: w.ghostFile, bosses: [] };
    ghostWins[w.ghost].bosses.push(w.boss);
  });

  // Only include ghosts that won at least one fight
  Object.entries(ghostWins).forEach(([ghostName, data]) => {
    const entry = {
      ghost: ghostName,
      file: data.file,
      defeated: data.bosses,
      fallen: deadNames.includes(ghostName)
    };
    if (entry.fallen && killedBy[ghostName]) entry.killedBy = killedBy[ghostName];
    hof.push(entry);
  });

  saveHallOfFame(hof);
}
