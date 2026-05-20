// =================================================================
// RAID SHOP — Purchase cards/packs with Raid Points
// Depends on: cards.js (RAID_SHOP_ITEMS, getActiveGhosts, getGhostsByRarity)
// =================================================================

// ─── SHOP RENDERING ─────────────────────────────────────────────

function showRaidShop() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  db.ref(`mp/users/${user.uid}`).once('value').then(snap => {
    const userData = snap.val() || {};
    renderRaidShop(userData.raidPoints || 0, userData.collection || [], userData.raidBadges || []);
  });
}

function renderRaidShop(points, collection, badges) {
  const container = document.getElementById('raid-shop');
  if (!container) return;

  let html = `
    <div class="raid-shop-header">
      <h2 class="raid-section-title">RAID SHOP</h2>
      <div class="raid-shop-balance">
        <span class="raid-points-icon">&#x2B50;</span>
        <span class="raid-points-amount">${points}</span>
        <span class="raid-points-label">Raid Points</span>
      </div>
    </div>
    <div class="raid-shop-badges">
      <h3>YOUR BADGES</h3>
      ${renderRaidBadges(badges)}
    </div>
    <div class="raid-shop-items">
      <h3>PACKS</h3>
      <div class="raid-shop-grid">`;

  RAID_SHOP_ITEMS.forEach(item => {
    const canAfford = points >= item.cost;
    html += `<div class="raid-shop-item ${canAfford ? '' : 'cannot-afford'}">
      <div class="raid-shop-item-icon">${item.img ? `<img src="${item.img}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : (item.type === 'pack' ? '&#x1F4E6;' : '&#x1F0CF;')}</div>
      <div class="raid-shop-item-name">${item.name}</div>
      <div class="raid-shop-item-desc">${item.desc}</div>
      <div class="raid-shop-item-cost">
        <span class="raid-points-icon">&#x2B50;</span> ${item.cost}
      </div>
      <button class="raid-shop-buy-btn" ${canAfford ? '' : 'disabled'}
              onclick="purchaseRaidItem('${item.id}')">
        ${canAfford ? 'BUY' : 'NOT ENOUGH'}
      </button>
    </div>`;
  });

  html += '</div></div>';

  // Stats section
  html += `
    <div class="raid-shop-stats">
      <h3>YOUR RAID STATS</h3>
      <div id="raid-stats-content">Loading...</div>
    </div>`;

  container.innerHTML = html;

  // Load stats
  const user = firebase.auth().currentUser;
  if (user) {
    db.ref(`mp/users/${user.uid}/raidStats`).once('value').then(snap => {
      const stats = snap.val() || {};
      const el = document.getElementById('raid-stats-content');
      if (el) {
        el.innerHTML = `
          <div class="raid-stat-row"><span>Raids Completed</span><span>${stats.raidsCompleted || 0}</span></div>
          <div class="raid-stat-row"><span>Total Boss Damage</span><span>${stats.totalBossDamage || 0}</span></div>
          <div class="raid-stat-row"><span>Killing Blows</span><span>${stats.killingBlows || 0}</span></div>
          <div class="raid-stat-row"><span>Highest Tier Cleared</span><span>${stats.highestTier || 0}</span></div>`;
      }
    });
  }
}

// ─── PURCHASE LOGIC ─────────────────────────────────────────────

async function purchaseRaidItem(itemId) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const item = RAID_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  // Firebase transaction for atomic purchase
  const userRef = db.ref(`mp/users/${user.uid}`);
  const result = await userRef.transaction(userData => {
    if (!userData) return userData;
    const points = userData.raidPoints || 0;
    if (points < item.cost) return; // Abort — not enough points

    userData.raidPoints = points - item.cost;
    return userData;
  });

  if (!result.committed) {
    alert('Not enough Raid Points!');
    return;
  }

  // Generate the pack contents
  const cards = generateRaidPack(item);

  // Show pack opening
  showPackOpening(cards, item);

  // Add cards to collection
  const collSnap = await db.ref(`mp/users/${user.uid}/collection`).once('value');
  const collection = collSnap.val() || [];
  cards.forEach(c => {
    if (!collection.includes(c.id)) collection.push(c.id);
  });
  await db.ref(`mp/users/${user.uid}/collection`).set(collection);

  // Refresh shop
  setTimeout(() => showRaidShop(), 3000);
}

// ─── PACK GENERATION ────────────────────────────────────────────

function generateRaidPack(item) {
  const cards = [];
  let pool = getActiveGhosts();

  // Filter by set if specified
  if (item.set) {
    pool = pool.filter(g => g.set === item.set);
  }

  const packSize = item.id === 'pack_legendary' ? 3 : 5;

  for (let i = 0; i < packSize; i++) {
    const rarity = rollRarity(item);
    const candidates = pool.filter(g => g.rarity === rarity);
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      cards.push(pick);
    } else {
      // Fallback to any rarity from pool
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) cards.push(pick);
    }
  }

  return cards;
}

function rollRarity(item) {
  const r = Math.random();

  if (item.id === 'pack_legendary') {
    // Guaranteed legendary
    if (r < 0.5) return 'legendary';
    if (r < 0.8) return 'ghost-rare';
    return 'rare';
  }

  if (item.id === 'pack_premium') {
    // Guaranteed rare+
    if (r < 0.1) return 'legendary';
    if (r < 0.3) return 'ghost-rare';
    return 'rare';
  }

  // Standard pack
  if (r < 0.03) return 'legendary';
  if (r < 0.10) return 'ghost-rare';
  if (r < 0.30) return 'rare';
  if (r < 0.60) return 'uncommon';
  return 'common';
}

// ─── PACK OPENING ANIMATION ────────────────────────────────────

function showPackOpening(cards, item) {
  const overlay = document.createElement('div');
  overlay.className = 'raid-pack-overlay';
  overlay.innerHTML = `
    <div class="raid-pack-inner">
      <h2 class="raid-pack-title">${item.name}</h2>
      <div class="raid-pack-cards" id="raid-pack-cards"></div>
      <button class="raid-pack-close" onclick="this.closest('.raid-pack-overlay').remove()">CLOSE</button>
    </div>`;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 50);

  // Reveal cards one at a time
  const container = document.getElementById('raid-pack-cards');
  cards.forEach((card, i) => {
    setTimeout(() => {
      const cardEl = document.createElement('div');
      cardEl.className = `raid-pack-card ${card.rarity}`;
      cardEl.innerHTML = `
        <img src="${card.art}" alt="${card.name}" onerror="this.src='../testroom/art/timber.jpg'">
        <div class="raid-pack-card-name">${card.name}</div>
        <div class="raid-pack-card-rarity">${card.rarity.toUpperCase()}</div>`;
      container.appendChild(cardEl);
      setTimeout(() => cardEl.classList.add('revealed'), 50);
    }, i * 500);
  });
}

// ─── RAID POINTS DISPLAY (Top bar) ──────────────────────────────

function updateRaidPointsDisplay() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  db.ref(`mp/users/${user.uid}/raidPoints`).on('value', snap => {
    const points = snap.val() || 0;
    const el = document.getElementById('raid-points-display');
    if (el) el.textContent = points;
  });
}
