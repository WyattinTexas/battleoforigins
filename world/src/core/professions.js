// PROFESSIONS
// Profession skill tree — data, logic, and UI
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ PASSIVE PROFESSION XP ═══════
function addProfessionXP(type, amount) {
  if (!G.professionXP) G.professionXP = { combat:0, exploration:0, crafting:0, trade:0, charisma:0 };

  // Discipline bonus — +10% XP for matching discipline category
  const disciplineXPBonus = { fighter:'combat', scout:'exploration', artisan:'crafting', merchant:'trade' };
  if (G.discipline && disciplineXPBonus[G.discipline] === type) {
    amount = Math.ceil(amount * 1.1);
  }

  // House buff — +25% XP for 2 hours after visiting your house
  if (G.houseBuff && Date.now() < G.houseBuff.until) {
    amount = Math.ceil(amount * G.houseBuff.multiplier);
  }

  // Party bonus — +50% XP when grouped with other players
  if (typeof isInParty === 'function' && isInParty()) {
    amount = Math.ceil(amount * 1.5);
  }

  const prev = G.professionXP[type] || 0;
  G.professionXP[type] = prev + amount;

  // Check mastery level transition (using PROFESSION_MASTERY_LEVELS from globals.js)
  if (typeof PROFESSION_MASTERY_LEVELS !== 'undefined') {
    const prevMastery = getProfessionMasteryInfo(prev);
    const newMastery = getProfessionMasteryInfo(G.professionXP[type]);
    if (newMastery.name !== prevMastery.name) {
      const typeNames = { combat:'Combat', exploration:'Exploration', crafting:'Crafting', trade:'Trade', charisma:'Charisma' };
      notify(`${typeNames[type]}: ${newMastery.name} rank reached!`);
    }
  }

  // Milestone notifications (every 100 XP)
  const prevMilestone = Math.floor(prev / 100);
  const newMilestone = Math.floor(G.professionXP[type] / 100);
  if (newMilestone > prevMilestone) {
    const typeNames = { combat:'Combat', exploration:'Exploration', crafting:'Crafting', trade:'Trade', charisma:'Charisma' };
    notify(`${typeNames[type]} XP milestone: ${G.professionXP[type]}!`);
  }

  // Auto-save periodically (don't save on every tiny XP gain)
  if (amount >= 10) saveGame();
}

// ═══════ PROFESSION SKILL TREE ═══════
const SKILL_POINT_CAP = 80;

const PROFESSION_TREE = {
  ranger: { name:'Ranger', icon:'🏹', xpType:'exploration', tier:1, color:'#4a6',
    boxes: [
      { id:'rng_1', cost:5, xpReq:100, name:'Pathfinder', desc:'Move 10% faster, +20% survey concentration' },
      { id:'rng_2', cost:5, xpReq:250, name:'Tracker', desc:'Roaming enemies visible from further, rare enemies more often' },
      { id:'rng_3', cost:5, xpReq:500, name:'Region Walker', desc:'Collect region crystals: visit all 3 regions' },
      { id:'rng_4', cost:5, xpReq:800, name:'Warden', desc:'Unlock Spirit Ranger' },
    ]},
  spiritRanger: { name:'Spirit Ranger', icon:'👁️', xpType:'exploration', tier:2, requires:'rng_4', color:'#2a8',
    boxes: [
      { id:'sr_1', cost:8, xpReq:1200, name:'Crystal Seeker', desc:'Reveal hidden region crystals on minimap' },
      { id:'sr_2', cost:8, xpReq:1600, name:'Ghost Tracker', desc:'+1 die first roll, +10% recruit chance' },
      { id:'sr_3', cost:8, xpReq:2000, name:'Spirit Breaker', desc:'+15% dmg to Ghost-Rare+, legendaries in wild' },
      { id:'sr_4', cost:8, xpReq:2500, name:'Wilderness Master', desc:'Auto-swap on KO, no flee penalty, reveal hidden zones' },
    ]},
  tinkerer: { name:'Tinkerer', icon:'🔧', xpType:'crafting', tier:1, color:'#4ac',
    boxes: [
      { id:'tnk_1', cost:5, xpReq:100, name:'Apprentice', desc:'+1 experiment point' },
      { id:'tnk_2', cost:5, xpReq:200, name:'Assembler', desc:'Assembly roll +10' },
      { id:'tnk_3', cost:5, xpReq:350, name:'Journeyman', desc:'Craft commons anywhere' },
      { id:'tnk_4', cost:5, xpReq:500, name:'Artisan', desc:'Unlock craft specializations' },
    ]},
  blacksmith: { name:'Blacksmith', icon:'⚒️', xpType:'crafting', tier:2, requires:'tnk_4', color:'#888',
    boxes: [
      { id:'bs_1', cost:8, xpReq:800, name:'Forge Hand', desc:'Weapon+armor quality +50' },
      { id:'bs_2', cost:8, xpReq:1200, name:'Smith', desc:'Can use infusions' },
      { id:'bs_3', cost:8, xpReq:1600, name:'Master Smith', desc:'Unlock Armorer' },
      { id:'bs_4', cost:8, xpReq:2000, name:'Grand Smith', desc:'Legendary armor crafting' },
    ]},
  armorer: { name:'Armorer', icon:'🛡️', xpType:'crafting', tier:3, requires:'bs_3', color:'#68a',
    boxes: [
      { id:'arm_1', cost:10, xpReq:2500, name:'Plate Worker', desc:'Armor quality +100' },
      { id:'arm_2', cost:10, xpReq:3000, name:'Shield Master', desc:'+1 damage reduction' },
      { id:'arm_3', cost:10, xpReq:3500, name:'Iron Wall', desc:'Mastercraft armor guaranteed' },
    ]},
  swordsmith: { name:'Swordsmith', icon:'⚔️', xpType:'crafting', tier:2, requires:'tnk_4', color:'#a66',
    boxes: [
      { id:'ss_1', cost:8, xpReq:800, name:'Blade Apprentice', desc:'Blade quality +50' },
      { id:'ss_2', cost:8, xpReq:1200, name:'Swordsmith', desc:'+1 experiment on blades' },
      { id:'ss_3', cost:8, xpReq:1600, name:'Blade Master', desc:'Mastercraft blades' },
      { id:'ss_4', cost:8, xpReq:2000, name:'Sword Master', desc:'Unique blade schematics' },
    ]},
  blasterEng: { name:'Blaster Engineering', icon:'🔫', xpType:'crafting', tier:2, requires:'tnk_4', color:'#6a8',
    boxes: [
      { id:'be_1', cost:8, xpReq:800, name:'Tinkerer', desc:'Blaster quality +50' },
      { id:'be_2', cost:8, xpReq:1200, name:'Engineer', desc:'+1 experiment on blasters' },
      { id:'be_3', cost:8, xpReq:1600, name:'Blaster Smith', desc:'Mastercraft blasters' },
      { id:'be_4', cost:8, xpReq:2000, name:'Deadeye Engineer', desc:'Unique blaster schematics' },
    ]},
  frostMagic: { name:'Frost Magic', icon:'❄️', xpType:'crafting', tier:2, requires:'tnk_4', color:'#68c',
    boxes: [
      { id:'fm_1', cost:8, xpReq:800, name:'Frost Novice', desc:'Craft Frost Infusions' },
      { id:'fm_2', cost:8, xpReq:1200, name:'Frost Adept', desc:'Ice essence +15%' },
      { id:'fm_3', cost:8, xpReq:1600, name:'Frost Mage', desc:'Basic ice gear' },
      { id:'fm_4', cost:8, xpReq:2000, name:'Glacial Artisan', desc:'Master ice gear' },
    ]},
  flameMagic: { name:'Flame Magic', icon:'🔥', xpType:'crafting', tier:2, requires:'tnk_4', color:'#c64',
    boxes: [
      { id:'flm_1', cost:8, xpReq:800, name:'Flame Novice', desc:'Craft Flame Cores' },
      { id:'flm_2', cost:8, xpReq:1200, name:'Flame Adept', desc:'Fire essence +15%' },
      { id:'flm_3', cost:8, xpReq:1600, name:'Flame Mage', desc:'Basic fire gear' },
      { id:'flm_4', cost:8, xpReq:2000, name:'Volcanic Artisan', desc:'Master fire gear' },
    ]},
  maskMaker: { name:'Mask Maker', icon:'🎭', xpType:'crafting', tier:2, requires:'tnk_4', color:'#a6a',
    boxes: [
      { id:'mm_1', cost:8, xpReq:800, name:'Mask Apprentice', desc:'Craft basic masks' },
      { id:'mm_2', cost:8, xpReq:1200, name:'Mask Maker', desc:'Craft Mask Cores' },
      { id:'mm_3', cost:8, xpReq:1600, name:'Mask Artist', desc:'Mastercraft masks' },
      { id:'mm_4', cost:8, xpReq:2000, name:'Face Shaper', desc:'Unique mask schematics' },
    ]},
  charmCrafting: { name:'Charm Crafting', icon:'💎', xpType:'crafting', tier:2, requires:'tnk_4', color:'#6ac',
    boxes: [
      { id:'cc_1', cost:8, xpReq:800, name:'Charm Novice', desc:'Craft basic charms' },
      { id:'cc_2', cost:8, xpReq:1200, name:'Charm Crafter', desc:'Craft Enchantments' },
      { id:'cc_3', cost:8, xpReq:1600, name:'Spirit Weaver', desc:'Mastercraft charms' },
      { id:'cc_4', cost:8, xpReq:2000, name:'Spiritbinder', desc:'Unique charm schematics' },
    ]},
  merchant: { name:'Merchant', icon:'💰', xpType:'trade', tier:1, color:'#ca4',
    boxes: [
      { id:'mrc_1', cost:5, xpReq:100, name:'Peddler', desc:'+1 market listing slot' },
      { id:'mrc_2', cost:5, xpReq:200, name:'Trader', desc:'NPC trade hints' },
      { id:'mrc_3', cost:5, xpReq:350, name:'Dealer', desc:'Traps 25% faster' },
      { id:'mrc_4', cost:5, xpReq:500, name:'Broker', desc:'Unlock Tycoon' },
    ]},
  tycoon: { name:'Tycoon', icon:'👑', xpType:'trade', tier:2, requires:'mrc_4', color:'#ea4',
    boxes: [
      { id:'tyc_1', cost:8, xpReq:800, name:'Mogul', desc:'+2 market listing slots' },
      { id:'tyc_2', cost:8, xpReq:1200, name:'Baron', desc:'Market fees reduced' },
      { id:'tyc_3', cost:8, xpReq:1600, name:'Magnate', desc:'See all zone quality remotely' },
      { id:'tyc_4', cost:8, xpReq:2000, name:'Tycoon', desc:'Exclusive trade schematics' },
    ]},
  socialite: { name:'Socialite', icon:'🎉', xpType:'charisma', tier:1, color:'#c8a',
    boxes: [
      { id:'soc_1', cost:5, xpReq:100, name:'Regular', desc:'Tips doubled for receiver' },
      { id:'soc_2', cost:5, xpReq:200, name:'Networker', desc:'Guild invite range+' },
      { id:'soc_3', cost:5, xpReq:350, name:'Influencer', desc:'Cantina buffs' },
      { id:'soc_4', cost:5, xpReq:500, name:'Mayor', desc:'Unlock Governor' },
    ]},
  governor: { name:'Governor', icon:'🏛️', xpType:'charisma', tier:2, requires:'soc_4', color:'#e8c',
    boxes: [
      { id:'gov_1', cost:8, xpReq:800, name:'Councilor', desc:'Guild max size +5' },
      { id:'gov_2', cost:8, xpReq:1200, name:'Senator', desc:'Guild-wide crafting bonus' },
      { id:'gov_3', cost:8, xpReq:1600, name:'Chancellor', desc:'Zone buff aura' },
      { id:'gov_4', cost:8, xpReq:2000, name:'Governor', desc:'Name a landmark' },
    ]},
};

// Check if a skill box can be unlocked
function canUnlockBox(boxId) {
  if (!G.professionSkills) G.professionSkills = {};
  if (G.professionSkills[boxId]) return false; // already unlocked

  // Find the box in the tree
  for (const [profId, prof] of Object.entries(PROFESSION_TREE)) {
    const boxIdx = prof.boxes.findIndex(b => b.id === boxId);
    if (boxIdx === -1) continue;

    const box = prof.boxes[boxIdx];

    // Check skill point cap
    if ((G.skillPointsUsed || 0) + box.cost > SKILL_POINT_CAP) return false;

    // Check XP requirement
    if ((G.professionXP?.[prof.xpType] || 0) < box.xpReq) return false;

    // Check prerequisite profession unlock
    if (prof.requires && !G.professionSkills[prof.requires]) return false;

    // Check previous box in same profession (must unlock in order)
    if (boxIdx > 0 && !G.professionSkills[prof.boxes[boxIdx - 1].id]) return false;

    return true;
  }
  return false;
}

// Unlock a skill box
function unlockSkillBox(boxId) {
  if (!canUnlockBox(boxId)) return false;

  for (const [profId, prof] of Object.entries(PROFESSION_TREE)) {
    const box = prof.boxes.find(b => b.id === boxId);
    if (!box) continue;

    G.professionSkills[boxId] = true;
    G.skillPointsUsed = (G.skillPointsUsed || 0) + box.cost;

    notify(`Skill Unlocked: ${box.name} (${prof.name})`);
    SFX.levelUp();
    saveGame();
    return true;
  }
  return false;
}

// Check if player has a specific skill
function hasSkill(boxId) {
  return !!(G.professionSkills && G.professionSkills[boxId]);
}

// Get all active effects from unlocked skills
function getActiveEffects() {
  const effects = {};
  if (!G.professionSkills) return effects;

  for (const [profId, prof] of Object.entries(PROFESSION_TREE)) {
    for (const box of prof.boxes) {
      if (G.professionSkills[box.id]) {
        // Merge effect into accumulator
        Object.assign(effects, { [box.id]: true });
      }
    }
  }
  return effects;
}

// Get the highest unlocked title in each profession
function getProfessionTitles() {
  const titles = [];
  for (const [profId, prof] of Object.entries(PROFESSION_TREE)) {
    let highestBox = null;
    for (const box of prof.boxes) {
      if (G.professionSkills?.[box.id]) highestBox = box;
    }
    if (highestBox) titles.push({ prof: prof.name, icon: prof.icon, title: highestBox.name });
  }
  return titles;
}

// ═══════ PROFESSION TREE UI ═══════
function openProfTree() {
  document.getElementById('profTreeOverlay').classList.add('active');
  renderProfTree();
}

function closeProfTree() {
  document.getElementById('profTreeOverlay').classList.remove('active');
}

let selectedProfId = null;
let selectedBoxId = null;
let skillTabMode = 'my'; // 'my' or 'all'

// Build profession hierarchy for tree display in sidebar
function getProfTreeHierarchy() {
  // Find root professions (tier 1, no requires) and build parent->children map
  const roots = [];
  const childMap = {}; // parentProfId -> [childProfIds]

  // First pass: map requires (skill box id) -> profession that contains that box
  const boxToProfId = {};
  for (const [profId, prof] of Object.entries(PROFESSION_TREE)) {
    for (const box of prof.boxes) {
      boxToProfId[box.id] = profId;
    }
  }

  // Second pass: build tree
  for (const [profId, prof] of Object.entries(PROFESSION_TREE)) {
    if (!prof.requires) {
      roots.push(profId);
    } else {
      const parentProfId = boxToProfId[prof.requires];
      if (parentProfId) {
        if (!childMap[parentProfId]) childMap[parentProfId] = [];
        childMap[parentProfId].push(profId);
      }
    }
  }
  return { roots, childMap };
}

function switchSkillTab(mode) {
  skillTabMode = mode;
  document.getElementById('skTabMy').classList.toggle('active', mode === 'my');
  document.getElementById('skTabAll').classList.toggle('active', mode === 'all');
  renderProfTree();
}

function renderProfTree() {
  document.getElementById('skPointsUsed').textContent = G.skillPointsUsed || 0;
  document.getElementById('skPointsCap').textContent = SKILL_POINT_CAP;

  const { roots, childMap } = getProfTreeHierarchy();

  // === LEFT SIDEBAR ===
  const sidebar = document.getElementById('skSidebar');
  let sbHtml = '';

  sbHtml += '<div class="sk-sidebar-section"><div class="sk-sidebar-label">Professions</div>';

  // Recursive tree renderer for sidebar
  const renderSidebarProf = (profId, depth) => {
    const prof = PROFESSION_TREE[profId];
    const unlockedCount = prof.boxes.filter(b => hasSkill(b.id)).length;
    const isLocked = prof.requires && !hasSkill(prof.requires);
    const isActive = selectedProfId === profId;

    // In "my" mode, hide locked tier 2+ with no progress
    if (skillTabMode === 'my' && prof.tier > 1 && unlockedCount === 0 && isLocked) return;

    const children = childMap[profId] || [];
    const isChild = depth > 0;
    const connector = isChild ? (children.length > 0 ? '\u2514\u2192 ' : '\u2514\u2192 ') : '';

    sbHtml += `<div class="sk-prof-item ${isActive ? 'active' : ''} ${isChild ? 'sk-child' : ''}"
      onclick="selectProfession('${profId}')"
      style="${isLocked ? 'opacity:0.4;' : ''}${isChild ? 'padding-left:' + (12 + depth * 14) + 'px;' : ''}">
      <span style="font-size:9px;color:#1a3a5a;font-family:monospace;">${connector}</span>
      <span class="sk-prof-icon">${prof.icon}</span>
      <span>${prof.name}</span>
      <span class="sk-prof-boxes">${unlockedCount}/${prof.boxes.length}</span>
    </div>`;

    for (const childId of children) {
      renderSidebarProf(childId, depth + 1);
    }
  };

  for (const rootId of roots) {
    renderSidebarProf(rootId, 0);
  }
  sbHtml += '</div>';

  // My Experience
  sbHtml += '<div class="sk-sidebar-section"><div class="sk-sidebar-label">My Experience</div>';
  const xpTypes = { exploration:'Exploration', crafting:'Crafting', trade:'Trade', charisma:'Charisma' };
  for (const [id, label] of Object.entries(xpTypes)) {
    sbHtml += `<div class="sk-xp-item"><span>${label}</span><span class="sk-xp-val">${G.professionXP?.[id] || 0}</span></div>`;
  }
  sbHtml += '</div>';

  // Skill Points bar
  const ptsUsed = G.skillPointsUsed || 0;
  const ptsPct = Math.min(100, (ptsUsed / SKILL_POINT_CAP) * 100);
  sbHtml += `<div class="sk-points-bar">
    <div class="sk-points-label">Skill Points Available</div>
    <div class="sk-points-track"><div class="sk-points-fill" style="width:${ptsPct}%"></div></div>
    <div class="sk-points-text">${ptsUsed} / ${SKILL_POINT_CAP}</div>
  </div>`;

  sidebar.innerHTML = sbHtml;

  // === CENTER GRID ===
  const grid = document.getElementById('skGrid');
  const title = document.getElementById('skGridTitle');

  // "All Professions" mode — show every profession's grid
  if (skillTabMode === 'all' && !selectedProfId) {
    title.textContent = 'All Professions';
    let allHtml = '';
    for (const rootId of roots) {
      allHtml += renderProfGroupHtml(rootId, childMap);
    }
    grid.innerHTML = allHtml;
    return;
  }

  if (!selectedProfId || !PROFESSION_TREE[selectedProfId]) {
    title.textContent = 'Select a Profession';
    grid.innerHTML = '<div style="color:#556;font-size:13px;padding:40px;text-align:center;">Click a profession on the left to view its skill tree.</div>';
    return;
  }

  const prof = PROFESSION_TREE[selectedProfId];
  title.innerHTML = `${prof.icon} ${prof.name} <span class="sk-prof-tier">Tier ${prof.tier}</span>`;

  // Build 2x2 grid for the 4 boxes
  let gridHtml = '';
  gridHtml += `<div class="sk-novice-label">Novice ${prof.name}</div>`;
  gridHtml += '<div class="sk-connect-line"></div>';
  gridHtml += '<div class="sk-box-grid">';
  for (let i = 0; i < prof.boxes.length; i++) {
    const box = prof.boxes[i];
    const unlocked = hasSkill(box.id);
    const available = !unlocked && canUnlockBox(box.id);
    const isSelected = selectedBoxId === box.id;
    const cls = unlocked ? 'unlocked' : available ? 'available' : 'locked';

    gridHtml += `<div class="sk-box ${cls} ${isSelected ? 'selected' : ''}"
      onclick="selectSkillBox('${box.id}')">
      <div class="sk-box-num">${i + 1}</div>
      <div class="sk-box-name">${unlocked ? '\u2713 ' : ''}${box.name}</div>
      <div class="sk-box-desc">${box.desc}</div>
      <div class="sk-box-tier">${box.cost} pts \u00b7 ${box.xpReq} XP</div>
    </div>`;
  }
  gridHtml += '</div>';

  // If all boxes unlocked, show master label
  const allUnlocked = prof.boxes.every(b => hasSkill(b.id));
  if (allUnlocked) {
    gridHtml += '<div class="sk-connect-line"></div>';
    gridHtml += `<div class="sk-master-label">\u2605 Master ${prof.name} \u2605</div>`;
  }

  // Show children professions that branch from this one
  const children = childMap[selectedProfId] || [];
  if (children.length > 0) {
    gridHtml += '<div style="margin-top:16px;text-align:center;font-size:10px;color:#4a8aba;text-transform:uppercase;letter-spacing:1px;">Unlocks</div>';
    gridHtml += '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px;">';
    for (const childId of children) {
      const child = PROFESSION_TREE[childId];
      const childLocked = child.requires && !hasSkill(child.requires);
      gridHtml += `<div style="padding:6px 12px;background:${childLocked ? '#0a1420' : 'rgba(74,154,202,0.1)'};border:1px solid ${childLocked ? '#1a2a3a' : '#2a5a8a'};border-radius:4px;cursor:pointer;font-size:11px;color:${childLocked ? '#334' : '#8cf'};"
        onclick="selectProfession('${childId}')">${child.icon} ${child.name}</div>`;
    }
    gridHtml += '</div>';
  }

  grid.innerHTML = gridHtml;
}

// Render a profession group (root + children) for "All Professions" view
function renderProfGroupHtml(profId, childMap) {
  const prof = PROFESSION_TREE[profId];
  const unlockedCount = prof.boxes.filter(b => hasSkill(b.id)).length;
  const isLocked = prof.requires && !hasSkill(prof.requires);

  let html = `<div style="margin-bottom:20px;${isLocked ? 'opacity:0.4;' : ''}">`;
  html += `<div style="font-size:13px;font-weight:bold;color:${prof.color || '#8cf'};margin-bottom:6px;cursor:pointer;"
    onclick="selectProfession('${profId}')">${prof.icon} ${prof.name}
    <span style="font-size:10px;color:#556;margin-left:6px;">${unlockedCount}/${prof.boxes.length}</span></div>`;

  html += '<div class="sk-box-grid" style="max-width:400px;margin-bottom:4px;">';
  for (const box of prof.boxes) {
    const unlocked = hasSkill(box.id);
    const available = !unlocked && canUnlockBox(box.id);
    const cls = unlocked ? 'unlocked' : available ? 'available' : 'locked';
    html += `<div class="sk-box ${cls}" onclick="selectProfession('${profId}');selectSkillBox('${box.id}')" style="padding:6px;">
      <div class="sk-box-name" style="font-size:9px;">${unlocked ? '\u2713 ' : ''}${box.name}</div>
      <div class="sk-box-tier">${box.cost}pts</div>
    </div>`;
  }
  html += '</div>';

  // Recurse into children
  const children = childMap[profId] || [];
  if (children.length > 0) {
    html += '<div style="padding-left:16px;border-left:1px solid #1a3a5a;margin-left:8px;">';
    for (const childId of children) {
      html += renderProfGroupHtml(childId, childMap);
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function selectProfession(profId) {
  selectedProfId = profId;
  selectedBoxId = null;
  renderProfTree();
}

function selectSkillBox(boxId) {
  selectedBoxId = boxId;

  // Find the box
  for (const [profId, prof] of Object.entries(PROFESSION_TREE)) {
    const boxIdx = prof.boxes.findIndex(b => b.id === boxId);
    if (boxIdx === -1) continue;
    const box = prof.boxes[boxIdx];

    const unlocked = hasSkill(box.id);
    const available = canUnlockBox(box.id);
    const detail = document.getElementById('skDetail');

    // Progress checks
    const currentXP = G.professionXP?.[prof.xpType] || 0;
    const xpMet = currentXP >= box.xpReq;
    const ptsRemaining = SKILL_POINT_CAP - (G.skillPointsUsed || 0);
    const ptsMet = ptsRemaining >= box.cost;
    const prevMet = boxIdx === 0 || hasSkill(prof.boxes[boxIdx - 1].id);
    const reqMet = !prof.requires || hasSkill(prof.requires);

    // Find prerequisite profession name if needed
    let reqProfName = '';
    if (prof.requires) {
      for (const [pid, p] of Object.entries(PROFESSION_TREE)) {
        if (p.boxes.some(b => b.id === prof.requires)) { reqProfName = p.name; break; }
      }
    }

    detail.innerHTML = `
      <div class="sk-detail-name">${prof.icon} ${box.name}</div>
      <div class="sk-detail-desc">${box.desc}</div>
      <div class="sk-detail-req">Cost: ${box.cost} skill points &middot; Requires: ${box.xpReq} ${prof.xpType} XP
        ${reqProfName ? ' &middot; Requires: ' + reqProfName : ''}</div>
      <div class="sk-detail-progress">
        <span class="${xpMet ? 'met' : 'unmet'}">${xpMet ? '\u2713' : '\u2717'} XP: ${currentXP}/${box.xpReq}</span>
        <span class="${ptsMet ? 'met' : 'unmet'}">${ptsMet ? '\u2713' : '\u2717'} Points: ${ptsRemaining} avail</span>
        <span class="${prevMet ? 'met' : 'unmet'}">${prevMet ? '\u2713' : '\u2717'} Prev skill</span>
        ${prof.requires ? `<span class="${reqMet ? 'met' : 'unmet'}">${reqMet ? '\u2713' : '\u2717'} ${reqProfName}</span>` : ''}
      </div>
      ${unlocked ? '<div style="color:#5cb87a;font-size:12px;margin-top:6px;font-weight:bold;">\u2713 Unlocked</div>' :
        available ? `<button class="sk-detail-btn" onclick="clickUnlockBox('${box.id}')">UNLOCK SKILL</button>` :
        '<div style="color:#556;font-size:11px;margin-top:6px;">\ud83d\udd12 Locked \u2014 requirements not met</div>'}
    `;
    break;
  }

  renderProfTree(); // re-render to update selection highlight
}

function clickUnlockBox(boxId) {
  if (unlockSkillBox(boxId)) {
    renderProfTree();
    updateHUD();
  }
}

