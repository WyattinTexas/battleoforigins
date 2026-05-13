// ══════════════════════════════════════════════════════════
//  WILLPOWER SYSTEM — Replaces traditional HP
//  Ported from testroom2 (drbango.com/testroom2/)
//  Willpower cards ARE HP. ghost.hp = ghost.willpower.length
//  Shared team deck with reshuffle mechanic.
// ══════════════════════════════════════════════════════════

const WILLPOWER_CARDS = [
  { id: 1,  name: 'Bonanza',          color: 'red',    emoji: '💥', effect: 'bonanza',        desc: '+2 damage to wins' },
  { id: 2,  name: 'Spark',            color: 'red',    emoji: '⚡', effect: 'spark',          desc: 'Gain +1 Surge' },
  { id: 3,  name: 'Ignite',           color: 'red',    emoji: '🔥', effect: 'ignite',         desc: 'Gain 1 Burn' },
  { id: 4,  name: 'Pow',              color: 'red',    emoji: '💢', effect: 'pow',            desc: '+2 damage for each 2 you roll' },
  { id: 5,  name: 'Gain Moonstone',   color: 'blue',   emoji: '💎', effect: 'gainMoonstone',  desc: 'Gain 1 Moon Stone' },
  { id: 6,  name: 'Gain Lucky Stone', color: 'blue',   emoji: '🍀', effect: 'gainLucky',      desc: 'Gain 1 Lucky Stone' },
  { id: 7,  name: 'Pepo',             color: 'blue',   emoji: '👻', effect: 'pepo',           desc: 'Flick a die to alter results' },
  { id: 8,  name: 'Gain Frostbite',   color: 'blue',   emoji: '❄️', effect: 'gainFrostbite',  desc: 'Gain 1 Frostbite' },
  { id: 9,  name: 'Gain Shell',       color: 'green',  emoji: '🛡️', effect: 'gainShell',      desc: 'Block 1 damage this round' },
  { id: 10, name: 'Gain Scorch',      color: 'green',  emoji: '☄️', effect: 'gainScorch',     desc: 'Burn ALL sideline chars (both teams)' },
  { id: 11, name: 'Gain Firefly',     color: 'orange', emoji: '✨', effect: 'gainFirefly',    desc: 'Wild card — costs 4 HP', hpCost: 4 },
  { id: 12, name: 'Gain Sacred Fire', color: 'orange', emoji: '🔥', effect: 'gainSacredFire', desc: 'Gain Sacred Fire — costs 3 HP', hpCost: 3 },
];

function wpCardById(id) {
  return WILLPOWER_CARDS.find(c => c.id === id);
}

// ── Deck Building ──────────────────────────────────────

// Build a shuffled Willpower deck from config
// config = { [cardId]: count } e.g. { 1:2, 2:1, 5:2, ... }
function buildTeamWillpowerDeck(config) {
  const deck = [];
  WILLPOWER_CARDS.forEach(c => {
    const cnt = (config && config[c.id]) || 0;
    for (let i = 0; i < cnt; i++) deck.push(c.id);
  });
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Default deck config for new players (balanced mix)
function getDefaultWpDeckConfig() {
  const config = {};
  WILLPOWER_CARDS.forEach((c, i) => {
    config[c.id] = i < 3 ? 2 : 1; // 2 copies of first 3, 1 copy of rest
  });
  return config;
}

// Get total cards in a deck config
function wpDeckTotal(config) {
  return Object.values(config || {}).reduce((s, v) => s + v, 0);
}

// ── Drawing & Hand Management ──────────────────────────

// Draw willpower cards from team deck for a ghost entering play
// team = { wpDeck: [...], wpDiscard: [...], ghosts: [...] }
// ghost = { willpower: [], hp, maxHp, ... }
function wpDrawFromTeam(team, ghost, logFn) {
  const need = ghost.maxHp;
  ghost.willpower = [];
  ghost.wpPending = false;
  ghost.willpowerUsedThisTurn = false;
  ghost.willpowerTopLocked = false;
  ghost.shellActive = false;

  for (let i = 0; i < need; i++) {
    // If team deck is empty, reshuffle team discard into deck
    if (team.wpDeck.length === 0 && team.wpDiscard.length > 0) {
      team.wpDeck = [...team.wpDiscard];
      team.wpDiscard = [];
      // Fisher-Yates shuffle
      for (let j = team.wpDeck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [team.wpDeck[j], team.wpDeck[k]] = [team.wpDeck[k], team.wpDeck[j]];
      }
      if (logFn) logFn('Willpower deck reshuffled!');
    }
    if (team.wpDeck.length > 0) {
      ghost.willpower.push(team.wpDeck.shift());
    }
  }
  ghost.hp = ghost.willpower.length;
  ghost.maxHp = ghost.willpower.length;
}

// Find the team object that owns a ghost (searches B.red and B.blue, or B.player and B.enemy)
function wpTeamOf(ghost) {
  if (!B) return null;
  // Support both red/blue and player/enemy naming
  if (B.red && B.red.ghosts && B.red.ghosts.includes(ghost)) return B.red;
  if (B.blue && B.blue.ghosts && B.blue.ghosts.includes(ghost)) return B.blue;
  if (B.player && B.player.ghosts && B.player.ghosts.includes(ghost)) return B.player;
  if (B.enemy && B.enemy.ghosts && B.enemy.ghosts.includes(ghost)) return B.enemy;
  return null;
}

// ── Damage & Healing ───────────────────────────────────

// Deal damage = remove cards from willpower hand → team discard
function wpDamage(ghost, amount) {
  const team = wpTeamOf(ghost);
  for (let i = 0; i < amount && ghost.willpower.length > 0; i++) {
    const removed = ghost.willpower.shift();
    if (team) team.wpDiscard.push(removed);
  }
  ghost.hp = ghost.willpower.length;
  if (ghost.hp <= 0) ghost.ko = true;
}

// Heal = pull random cards from team discard → willpower hand
function wpHeal(ghost, amount) {
  const team = wpTeamOf(ghost);
  if (!team) return;
  for (let i = 0; i < amount; i++) {
    if (team.wpDiscard.length === 0) break;
    const idx = Math.floor(Math.random() * team.wpDiscard.length);
    const card = team.wpDiscard.splice(idx, 1)[0];
    ghost.willpower.push(card);
  }
  ghost.hp = ghost.willpower.length;
}

// ── Activation ─────────────────────────────────────────

// Activate the top willpower card (player clicks it pre-roll)
// Returns the card that was activated, or null if blocked
function activateWillpower(team, teamName, logFn) {
  if (!B) return null;
  const t = B[team] || B[teamName];
  if (!t) return null;
  const f = t.ghosts[t.activeIdx];
  if (!f || f.ko || !f.willpower || f.willpower.length === 0) return null;

  // One per round check
  if (B.wpUsedThisTurn && B.wpUsedThisTurn[teamName]) return null;

  const topId = f.willpower[0];
  const card = wpCardById(topId);
  if (!card) return null;

  // HP cost check for expensive cards
  const cost = card.hpCost || 1;
  if (f.willpower.length < cost) {
    if (logFn) logFn(`Not enough willpower for ${card.name} (need ${cost})!`);
    return null;
  }

  // Remove top card (1 HP base cost) → team discard
  f.willpower.shift();
  t.wpDiscard.push(topId);
  if (!B.wpUsedThisTurn) B.wpUsedThisTurn = {};
  B.wpUsedThisTurn[teamName] = true;
  f.willpowerTopLocked = true;
  f.hp = f.willpower.length;

  // Apply the effect
  applyWillpowerEffect(t, teamName, card);

  if (logFn) logFn(`${f.name} activated ${card.name} — ${card.desc}`);
  return card;
}

// Apply a willpower card's effect to team state
function applyWillpowerEffect(t, teamName, card) {
  const f = t.ghosts[t.activeIdx];
  const oppTeamName = teamName === 'red' ? 'blue' : (teamName === 'player' ? 'enemy' : 'red');

  switch (card.effect) {
    case 'bonanza':
      if (!B.wpBonanza) B.wpBonanza = {};
      B.wpBonanza[teamName] = 2;
      break;
    case 'spark':
      t.resources.surge = (t.resources.surge || 0) + 1;
      break;
    case 'ignite':
      t.resources.burn = (t.resources.burn || 0) + 1;
      break;
    case 'pow':
      if (!B.wpPow) B.wpPow = {};
      B.wpPow[teamName] = true;
      break;
    case 'gainMoonstone':
      t.resources.moonstone = Math.min(1, (t.resources.moonstone || 0) + 1);
      break;
    case 'gainLucky':
      t.resources.luckyStone = (t.resources.luckyStone || 0) + 1;
      break;
    case 'pepo':
      if (!B.wpPepo) B.wpPepo = {};
      B.wpPepo[teamName] = true;
      break;
    case 'gainFrostbite':
      t.resources.frostbite = (t.resources.frostbite || 0) + 1;
      break;
    case 'gainShell':
      f.shellActive = true;
      break;
    case 'gainScorch':
      // Burn ALL sideline chars on both teams
      const sides = B.red ? ['red', 'blue'] : ['player', 'enemy'];
      sides.forEach(side => {
        const sTeam = B[side];
        if (!sTeam) return;
        sTeam.ghosts.forEach((g, idx) => {
          if (idx !== sTeam.activeIdx && !g.ko) {
            if (!B.burn) B.burn = {};
            if (!B.burn[side]) B.burn[side] = {};
            B.burn[side][idx] = (B.burn[side][idx] || 0) + 1;
          }
        });
      });
      break;
    case 'gainFirefly':
      // Extra 3 HP cost (total 4: 1 base + 3 extra)
      wpDamage(f, 3);
      t.resources.firefly = Math.min(1, (t.resources.firefly || 0) + 1);
      break;
    case 'gainSacredFire':
      // Extra 2 HP cost (total 3: 1 base + 2 extra)
      wpDamage(f, 2);
      t.resources.fire = (t.resources.fire || 0) + 1;
      break;
  }
}
