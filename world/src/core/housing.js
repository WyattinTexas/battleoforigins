// HOUSING
// Player housing — claim, build, trophies, visiting
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ PLAYER HOUSING ═══════

function tryClaimPlot(plot) {
  if (G.house) {
    notify('You already own a house! Demolish it first to claim a new plot.');
    return;
  }
  if (G.coins < 100) {
    notify('You need 100 coins to claim this plot!');
    return;
  }

  const overlay = document.getElementById('housingOverlay');
  document.getElementById('housingTitle').innerHTML = 'Claim Plot';
  document.getElementById('housingName').textContent = plot.name;
  document.getElementById('housingInfo').textContent = `Region: ${plot.region} | Cost: 100 coins | You have ${G.coins} coins`;
  document.getElementById('housingActions').innerHTML = `
    <button class="housing-btn" onclick="confirmClaimPlot('${plot.id}')">
      <span class="btn-icon">&#128176;</span> Claim for 100 coins
    </button>
  `;
  overlay.classList.add('active');
}

function confirmClaimPlot(plotId) {
  if (G.coins < 100) { notify('Not enough coins!'); closeHousing(); return; }
  if (G.house) { notify('You already own a house!'); closeHousing(); return; }

  G.coins -= 100;
  const plot = HOUSE_PLOTS.find(p => p.id === plotId);
  G.house = { plotId, houseName: G.name + "'s Cottage", built: true, trophies: [] };

  const houseRecord = {
    owner: uid,
    ownerName: G.name,
    houseName: G.house.houseName,
    built: true,
    claimedAt: firebase.database.ServerValue.TIMESTAMP,
    trophies: [],
  };

  housingData[plotId] = { ...houseRecord, owner: uid, ownerName: G.name, claimedAt: Date.now() };

  // Save to Firebase
  if (!window._useLocalStorage) {
    try { db.ref(`overworld/housing/${plotId}`).set(houseRecord); } catch(e) {}
  }

  saveGame();
  updateHUD();
  closeHousing();
  notify(`You claimed "${plot.name}"! Welcome home!`);
  SFX.notify();
}

function openMyHouse(plot) {
  const overlay = document.getElementById('housingOverlay');
  document.getElementById('housingTitle').innerHTML = 'Welcome Home!';
  document.getElementById('housingName').textContent = G.house.houseName || (G.name + "'s House");
  document.getElementById('housingInfo').textContent = `Plot: ${plot.name} | ${plot.region}`;

  let trophyHtml = '';
  if (G.house.trophies && G.house.trophies.length > 0) {
    trophyHtml = '<div class="trophy-list">' + G.house.trophies.map(tid => {
      const t = TROPHY_DEFS[tid];
      return t ? `<div class="trophy-item"><span class="trophy-icon">${t.icon}</span> ${t.name}</div>` : '';
    }).join('') + '</div>';
  } else {
    trophyHtml = '<div style="color:#666;font-size:12px;margin:8px 0;">No trophies displayed yet.</div>';
  }

  // Check which trophies the player has earned
  const earnedTrophies = checkEarnedTrophies();
  const availableTrophies = earnedTrophies.filter(t => !(G.house.trophies || []).includes(t));

  let addTrophyBtn = '';
  if (availableTrophies.length > 0 && (G.house.trophies || []).length < 5) {
    addTrophyBtn = `<button class="housing-btn" onclick="showAddTrophy()">
      <span class="btn-icon"></span> Display a Trophy (${availableTrophies.length} available)
    </button>`;
  }

  document.getElementById('housingActions').innerHTML = `
    <button class="housing-btn" onclick="showTrophies()">
      <span class="btn-icon"></span> View Trophies (${(G.house.trophies||[]).length}/5)
    </button>
    ${addTrophyBtn}
    <button class="housing-btn" onclick="renameHouse()">
      <span class="btn-icon">&#9999;&#65039;</span> Rename House
    </button>
    <button class="housing-btn" onclick="demolishHouse()" style="border-color:#6a3a3a;">
      <span class="btn-icon">&#128465;&#65039;</span> Demolish (refund 50 coins)
    </button>
  `;

  overlay.classList.add('active');
}

function openOtherHouse(plot, owner) {
  const overlay = document.getElementById('housingOverlay');
  document.getElementById('housingTitle').innerHTML = (owner.ownerName || 'Unknown') + "'s House";
  document.getElementById('housingName').textContent = owner.houseName || (owner.ownerName + "'s House");
  document.getElementById('housingInfo').textContent = `Plot: ${plot.name}`;

  let trophyHtml = '<div style="color:#666;font-size:12px;margin:8px 0;">No trophies displayed.</div>';
  if (owner.trophies && owner.trophies.length > 0) {
    trophyHtml = '<div class="trophy-list">' + owner.trophies.map(tid => {
      const t = TROPHY_DEFS[tid];
      return t ? `<div class="trophy-item"><span class="trophy-icon">${t.icon}</span> ${t.name} <span style="color:#666;font-size:10px;">${t.desc}</span></div>` : '';
    }).join('') + '</div>';
  }

  document.getElementById('housingActions').innerHTML = trophyHtml;
  overlay.classList.add('active');
}

function closeHousing() {
  document.getElementById('housingOverlay').classList.remove('active');
}

function showTrophies() {
  const actionsEl = document.getElementById('housingActions');
  const trophies = G.house?.trophies || [];

  if (trophies.length === 0) {
    actionsEl.innerHTML = '<div style="color:#666;font-size:12px;margin:12px 0;">No trophies yet. Defeat bosses, master crafting, or collect rare lore to earn them!</div>' +
      '<button class="housing-btn" onclick="openMyHouse(HOUSE_PLOTS.find(p=>p.id===G.house.plotId))"><span class="btn-icon">&#8592;</span> Back</button>';
    return;
  }

  actionsEl.innerHTML = '<div class="trophy-list">' + trophies.map(tid => {
    const t = TROPHY_DEFS[tid];
    return t ? `<div class="trophy-item"><span class="trophy-icon">${t.icon}</span> <strong>${t.name}</strong> — <span style="color:#888;">${t.desc}</span></div>` : '';
  }).join('') + '</div>' +
    '<button class="housing-btn" onclick="openMyHouse(HOUSE_PLOTS.find(p=>p.id===G.house.plotId))"><span class="btn-icon">&#8592;</span> Back</button>';
}

function checkEarnedTrophies() {
  const earned = [];
  if ((G.rep?.battlesWon || 0) >= 10) earned.push('boss_slayer');
  if ((G.mastery?.weapon?.xp || 0) >= 500) earned.push('mastercraft_weapon');
  if ((G.mastery?.armor?.xp || 0) >= 500) earned.push('mastercraft_armor');
  if ((G.professionXP?.combat || 0) >= 1000) earned.push('master_combat');
  if ((G.professionXP?.exploration || 0) >= 1000) earned.push('master_exploration');
  if ((G.rep?.raresFound || 0) >= 10) earned.push('collector_rare');
  if ((G.rep?.arenaWins || 0) >= 20) earned.push('arena_champion');
  // Lore trophies — check if all lore in region collected
  const frostLore = (typeof LORE_ITEMS !== 'undefined') ? LORE_ITEMS.filter(l => l.region === 'frost_valley') : [];
  const hillsLore = (typeof LORE_ITEMS !== 'undefined') ? LORE_ITEMS.filter(l => l.region === 'rolling_hills') : [];
  const volcanicLore = (typeof LORE_ITEMS !== 'undefined') ? LORE_ITEMS.filter(l => l.region === 'volcanic_isles') : [];
  if (frostLore.length > 0 && frostLore.every(l => (G.loreCollected || []).includes(l.id))) earned.push('lore_frost');
  if (hillsLore.length > 0 && hillsLore.every(l => (G.loreCollected || []).includes(l.id))) earned.push('lore_hills');
  if (volcanicLore.length > 0 && volcanicLore.every(l => (G.loreCollected || []).includes(l.id))) earned.push('lore_volcanic');
  return earned;
}

function showAddTrophy() {
  const earned = checkEarnedTrophies();
  const displayed = G.house?.trophies || [];
  const available = earned.filter(t => !displayed.includes(t));

  if (available.length === 0) { notify('No new trophies to add!'); return; }
  if (displayed.length >= 5) { notify('Trophy display is full! (5/5)'); return; }

  const actionsEl = document.getElementById('housingActions');
  actionsEl.innerHTML = '<div style="color:#aaa;font-size:12px;margin-bottom:8px;">Choose a trophy to display:</div>' +
    available.map(tid => {
      const t = TROPHY_DEFS[tid];
      return `<button class="housing-btn" onclick="addTrophy('${tid}')"><span class="btn-icon">${t.icon}</span> ${t.name} — <span style="color:#888;">${t.desc}</span></button>`;
    }).join('') +
    '<button class="housing-btn" onclick="openMyHouse(HOUSE_PLOTS.find(p=>p.id===G.house.plotId))"><span class="btn-icon">&#8592;</span> Back</button>';
}

function addTrophy(trophyId) {
  if (!G.house) return;
  if (!G.house.trophies) G.house.trophies = [];
  if (G.house.trophies.length >= 5) { notify('Trophy display is full!'); return; }
  if (G.house.trophies.includes(trophyId)) { notify('Already displayed!'); return; }

  G.house.trophies.push(trophyId);

  // Update Firebase
  if (!window._useLocalStorage) {
    try { db.ref(`overworld/housing/${G.house.plotId}/trophies`).set(G.house.trophies); } catch(e) {}
  }
  // Update local cache
  if (housingData[G.house.plotId]) housingData[G.house.plotId].trophies = [...G.house.trophies];

  saveGame();
  const t = TROPHY_DEFS[trophyId];
  notify(`${t.icon} ${t.name} trophy displayed!`);
  openMyHouse(HOUSE_PLOTS.find(p => p.id === G.house.plotId));
}

function renameHouse() {
  const newName = prompt('Enter a new name for your house (max 24 chars):', G.house.houseName || '');
  if (!newName || !newName.trim()) return;
  const trimmed = newName.trim().slice(0, 24);
  G.house.houseName = trimmed;

  if (housingData[G.house.plotId]) housingData[G.house.plotId].houseName = trimmed;
  if (!window._useLocalStorage) {
    try { db.ref(`overworld/housing/${G.house.plotId}/houseName`).set(trimmed); } catch(e) {}
  }

  saveGame();
  notify(`House renamed to "${trimmed}"`);
  openMyHouse(HOUSE_PLOTS.find(p => p.id === G.house.plotId));
}

function demolishHouse() {
  if (!G.house) return;
  if (!confirm('Are you sure? You will get 50 coins back.')) return;

  const plotId = G.house.plotId;
  G.coins += 50;
  G.house = null;
  delete housingData[plotId];

  if (!window._useLocalStorage) {
    try { db.ref(`overworld/housing/${plotId}`).remove(); } catch(e) {}
  }

  saveGame();
  updateHUD();
  closeHousing();
  notify('House demolished. 50 coins refunded.');
}

function panToHome() {
  if (!G.house) return;
  const plot = HOUSE_PLOTS.find(p => p.id === G.house.plotId);
  if (!plot) return;
  // Flash the minimap home dot
  showHomeOnMinimap = true;
  setTimeout(() => { showHomeOnMinimap = false; }, 5000);
  notify(`Your home is at ${plot.name} (${plot.region})`);
}

function initHousingListener() {
  if (window._useLocalStorage) return;
  try {
    db.ref('overworld/housing').on('value', snap => {
      const data = snap.val() || {};
      housingData = data;
    });
  } catch(e) {
    console.warn('Housing listener failed:', e);
  }
}

// ═══════ HUD ═══════
