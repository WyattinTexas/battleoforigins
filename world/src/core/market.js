// MARKET
// Market — player-to-player trading + tipping
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ MARKET SYSTEM ═══════

let marketTab = 'browse';

function openMarket() {
  // Check if near general store or hub
  const tileX = Math.floor(G.x);
  const tileY = Math.floor(G.y);
  let nearShop = false;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const t = worldMap[tileY+dy]?.[tileX+dx];
    if (t === 5 || t === 8) nearShop = true;
  }
  if (!nearShop) {
    notify('Head to the hub town to access the Market Board!');
    return;
  }

  marketTab = 'browse';
  loadMarketListings();
  renderMarket();
  document.getElementById('marketOverlay').classList.add('active');
}

function closeMarket() {
  document.getElementById('marketOverlay').classList.remove('active');
}

function switchMarketTab(tab) {
  marketTab = tab;
  document.getElementById('marketTabBrowse').classList.toggle('active', tab === 'browse');
  document.getElementById('marketTabSell').classList.toggle('active', tab === 'sell');
  document.getElementById('marketTabMy').classList.toggle('active', tab === 'my');
  renderMarket();
}

function loadMarketListings() {
  db.ref('overworld/market').once('value').then(snap => {
    marketListings = snap.val() || {};
    renderMarket();
  });
}

function renderMarket() {
  const content = document.getElementById('marketContent');

  if (marketTab === 'browse') {
    // Browse all listings from other players
    let html = '';
    let hasListings = false;
    for (const [sellerId, data] of Object.entries(marketListings)) {
      if (!data.listings) continue;
      for (let i = 0; i < data.listings.length; i++) {
        const listing = data.listings[i];
        if (!listing || !listing.item) continue;
        hasListings = true;
        const isMine = sellerId === uid;
        const arenaWins = listing.sellerArenaWins || 0;
        const badge = arenaWins >= 5 ? '<span style="color:#daa520;font-size:9px;"> ⚔ Verified Fighter</span>' : '';
        html += `<div class="market-listing">
          <div class="ml-info">
            <div class="ml-name">${listing.item.icon ? listing.item.icon + ' ' : ''}${listing.item.name} <span style="color:${listing.item.qualityTier === 'Mastercraft' ? '#4fc878' : listing.item.qualityTier === 'Superior' ? '#c8b040' : listing.item.qualityTier === 'Standard' ? '#c89040' : '#c85040'};font-size:10px;">[${listing.item.qualityTier}]</span></div>
            <div class="ml-seller">by ${data.name || 'Unknown'}${badge}</div>
            <div class="ml-quality">Quality ${listing.item.quality} | ${listing.item.qualityTier}</div>
          </div>
          <div class="ml-price">${listing.price} coins</div>
          ${isMine ? '' : `<button class="market-buy-btn" onclick="buyMarketItem('${sellerId}', ${i})">Buy</button>`}
        </div>`;
      }
    }
    if (!hasListings) {
      html = '<p style="color:#555;font-size:12px;text-align:center;padding:20px;">No items listed yet. Be the first!</p>';
    }
    content.innerHTML = html;

  } else if (marketTab === 'sell') {
    // Show player's gear that can be listed
    const myListings = marketListings[uid]?.listings || [];
    const listedCount = myListings.filter(l => l).length;

    if (G.gear.length === 0) {
      content.innerHTML = '<p style="color:#555;font-size:12px;text-align:center;padding:20px;">No gear to sell. Craft some items first!</p>';
      return;
    }
    if (listedCount >= 3) {
      content.innerHTML = '<p style="color:#f88;font-size:12px;text-align:center;padding:20px;">You have 3 items listed (max). Remove one to list another.</p>';
      return;
    }

    let html = '<p style="color:#888;font-size:11px;text-align:center;margin-bottom:8px;">Set a price and list your gear. Max 3 listings.</p>';
    for (let i = 0; i < G.gear.length; i++) {
      const g = G.gear[i];
      // Check if already listed
      const isListed = myListings.some(l => l && l.item && l.item.id === g.id);
      if (isListed) continue;
      html += `<div class="market-sell-row">
        <div class="ml-name">${g.name} <span style="font-size:10px;color:#888;">Q${g.quality}</span></div>
        <div style="margin-top:6px;">
          <input class="market-sell-input" type="number" min="1" max="999" value="10" id="price_${g.id}">
          <button class="market-list-btn" onclick="listMarketItem(${i})">List for Sale</button>
        </div>
      </div>`;
    }
    content.innerHTML = html;

  } else if (marketTab === 'my') {
    // Show my current listings
    const myData = marketListings[uid];
    const myListings = myData?.listings || [];
    if (myListings.filter(l => l).length === 0) {
      content.innerHTML = '<p style="color:#555;font-size:12px;text-align:center;padding:20px;">No active listings.</p>';
      return;
    }
    let html = '';
    for (let i = 0; i < myListings.length; i++) {
      const listing = myListings[i];
      if (!listing || !listing.item) continue;
      html += `<div class="market-listing">
        <div class="ml-info">
          <div class="ml-name">${listing.item.icon ? listing.item.icon + ' ' : ''}${listing.item.name} <span style="color:${listing.item.qualityTier === 'Mastercraft' ? '#4fc878' : listing.item.qualityTier === 'Superior' ? '#c8b040' : listing.item.qualityTier === 'Standard' ? '#c89040' : '#c85040'};font-size:10px;">[${listing.item.qualityTier}]</span></div>
          <div class="ml-quality">Quality ${listing.item.quality} | ${listing.item.qualityTier}</div>
        </div>
        <div class="ml-price">${listing.price} coins</div>
        <button class="market-remove-btn" onclick="removeMarketItem(${i})">Remove</button>
      </div>`;
    }
    content.innerHTML = html;
  }
}

function listMarketItem(gearIdx) {
  if (window._useLocalStorage) { notify('Market requires an online connection.'); return; }
  const gear = G.gear[gearIdx];
  if (!gear) return;

  const priceInput = document.getElementById(`price_${gear.id}`);
  const price = parseInt(priceInput?.value) || 10;
  if (price < 1 || price > 999) { notify('Price must be 1-999 coins.'); return; }

  // Read existing listings
  const myData = marketListings[uid] || { name: G.name, listings: [] };
  const listings = (myData.listings || []).filter(l => l);
  const maxListings = 3 + (hasSkill('mrc_1') ? 1 : 0); // Peddler: +1 slot
  if (listings.length >= maxListings) { notify(`Max ${maxListings} listings. Remove one first.`); return; }

  listings.push({ item: { ...gear }, price, listedAt: Date.now(), sellerArenaWins: G.rep?.arenaWins || 0 });

  // Save to Firebase
  db.ref(`overworld/market/${uid}`).set({ name: G.name, listings });
  marketListings[uid] = { name: G.name, listings };

  // Remove from player gear
  G.gear.splice(gearIdx, 1);

  // Reputation: items sold
  if (!G.rep) G.rep = { battlesWon:0, craftsCompleted:0, itemsSold:0, essencesCollected:0, raresFound:0 };
  G.rep.itemsSold++;
  checkAndNotifyTitles();

  addProfessionXP('trade', 10); // selling

  saveGame();
  notify(`Listed ${gear.name} for ${price} coins!`);
  renderMarket();
}

function removeMarketItem(listingIdx) {
  if (window._useLocalStorage) { notify('Market requires an online connection.'); return; }
  const myData = marketListings[uid];
  if (!myData || !myData.listings) return;

  const listing = myData.listings[listingIdx];
  if (!listing) return;

  // Return item to player gear
  G.gear.push(listing.item);

  // Remove from listings
  myData.listings.splice(listingIdx, 1);
  db.ref(`overworld/market/${uid}`).set({ name: G.name, listings: myData.listings });
  marketListings[uid] = myData;

  saveGame();
  notify(`Removed ${listing.item.name} from market.`);
  renderMarket();
}

function buyMarketItem(sellerId, listingIdx) {
  if (window._useLocalStorage) { notify('Market requires an online connection.'); return; }
  const sellerData = marketListings[sellerId];
  if (!sellerData || !sellerData.listings) return;

  const listing = sellerData.listings[listingIdx];
  if (!listing || !listing.item) { notify('Item no longer available.'); return; }

  if (G.coins < listing.price) { notify('Not enough coins!'); return; }

  // Deduct coins
  G.coins -= listing.price;

  // Add item to player gear
  G.gear.push(listing.item);

  // Remove listing from seller
  sellerData.listings.splice(listingIdx, 1);
  db.ref(`overworld/market/${sellerId}/listings`).set(sellerData.listings);
  marketListings[sellerId] = sellerData;

  // Credit coins to seller via Firebase transaction
  db.ref(`overworld/players/${sellerId}/coins`).transaction(current => {
    return (current || 0) + listing.price;
  });
  // Notify in chat
  addChatMessage('system', `${G.name} bought ${listing.item.name} from ${sellerData.name} for ${listing.price} coins!`);

  // Track seller reputation
  if (G.rep) { G.rep.itemsSold = (G.rep.itemsSold || 0); } // buyer side — seller tracks on their next load

  addProfessionXP('trade', 5); // buying

  saveGame();
  updateHUD();
  notify(`Bought ${listing.item.name} for ${listing.price} coins!`);
  renderMarket();
}


// ═══════ TIPPING SYSTEM ═══════

function processTipCommand(text) {
  if (window._useLocalStorage) { notify('Tipping requires an online connection.'); return true; }
  // Parse "/tip [name] [amount]"
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) {
    notify('Usage: /tip [name] [amount]');
    return true;
  }

  const targetName = parts[1];
  const amount = parseInt(parts[2]);

  if (isNaN(amount) || amount < 1) {
    notify('Tip amount must be a positive number.');
    return true;
  }
  if (amount > 100) {
    notify('Maximum tip is 100 coins per transaction.');
    return true;
  }
  if (amount > G.coins) {
    notify('Not enough coins to tip!');
    return true;
  }

  // Find recipient in presence
  let targetUid = null;
  for (const [pid, p] of Object.entries(otherPlayers)) {
    if (pid === uid) continue;
    if (p.name && p.name.toLowerCase() === targetName.toLowerCase()) {
      targetUid = pid;
      break;
    }
  }

  if (!targetUid) {
    notify(`Player "${targetName}" is not online.`);
    return true;
  }

  // Transfer coins
  G.coins -= amount;

  // Regular skill: tips doubled for receiver
  const tipAmount = hasSkill('soc_1') ? amount * 2 : amount;

  // Credit recipient via Firebase transaction
  db.ref(`overworld/players/${targetUid}/coins`).transaction(current => {
    return (current || 0) + tipAmount;
  });

  // Post system message in chat
  const guildPrefix = G.guild ? `[${G.guild.tag}] ` : '';
  const senderDisplay = guildPrefix + G.name;

  db.ref('overworld/chat').push({
    sender: 'system',
    text: `${senderDisplay} tipped ${targetName} ${tipAmount} coin${tipAmount > 1 ? 's' : ''}!${tipAmount > amount ? ' (Regular doubled it!)' : ''}`,
    ts: firebase.database.ServerValue.TIMESTAMP,
    isTip: true,
  });

  addProfessionXP('trade', 2); // tipping

  saveGame();
  updateHUD();
  notify(`Tipped ${targetName} ${tipAmount} coins!${tipAmount > amount ? ' (Regular doubled!)' : ''}`);
  return true;
}
