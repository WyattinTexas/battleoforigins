// ══════════════════════════════════════════════════════════════════════════════
// CONNECTORS — Ghost database (all spirits, stats, abilities)
// ══════════════════════════════════════════════════════════════════════════════

const ALL_GHOSTS = [
  // Ghost Rare
  { name:"Hector", file:"hector.jpg", rarity:"ghost-rare", maxHp:6, ability:"Protector", abilityDesc:"Singles beat doubles. +1 damage on singles." },
  { name:"Flora", file:"flora.jpg", rarity:"rare", maxHp:4, ability:"Restore", abilityDesc:"Roll doubles: +2 HP after damage is applied." },
  { name:"Skylar", file:"skylar.jpg", rarity:"ghost-rare", maxHp:7, ability:"Winter Barrage", abilityDesc:"Ice Shards deal +2 damage instead of +1." },
  { name:"Tyler", file:"tyler.jpg", rarity:"ghost-rare", maxHp:6, ability:"Heating Up", abilityDesc:"Before rolling, spend 2 HP to gain +1 die. Sacred Fires deal x2." },
  { name:"King Jay", file:"king_jay.jpg", rarity:"ghost-rare", maxHp:7, ability:"Reflection", abilityDesc:"Lose roll & dice total = 7: reflect all damage." },
  { name:"Piper", file:"piper.jpg", rarity:"ghost-rare", maxHp:6, ability:"Slick Coat", abilityDesc:"Negate enemy before-rolling effects. -1 enemy die next roll." },

  // Rare
  { name:"Stone Cold", file:"stone_cold.jpg", rarity:"rare", maxHp:7, ability:"One-two-one!", abilityDesc:"Roll double 1's: deal 3X damage." },
  { name:"Wim", file:"wim.jpg", rarity:"rare", maxHp:6, ability:"Slash", abilityDesc:"+5 damage when all dice are odd." },
  { name:"Spockles", file:"spockles.jpg", rarity:"rare", maxHp:6, ability:"Valley Magic", abilityDesc:"Win a roll: gain 2 Ice Shards." },
  { name:"Antoinette", file:"antoinette.jpg", rarity:"rare", maxHp:6, ability:"Grace", abilityDesc:"Roll as many dice as your opponent." },
  { name:"Kairan", file:"kairan.jpg", rarity:"rare", maxHp:3, ability:"Let's Dance", abilityDesc:"Roll doubles: +1 die next roll." },
  { name:"Katrina", file:"katrina.jpg", rarity:"rare", maxHp:5, ability:"Seeker", abilityDesc:"Before rolling, if you have less HP than the enemy, gain 1 HP." },
  { name:"Hard Luck Snorton", file:"snorton.jpg", rarity:"rare", maxHp:8, ability:"Fissure", abilityDesc:"+5 damage if you roll at least two 6's and deal damage." },
  { name:"Troubling Haters", file:"troubling_haters.jpg", rarity:"rare", maxHp:4, ability:"Growing Mob", abilityDesc:"Deal 4+ damage in a turn: gain +2 HP." },
  { name:"Wandering Sue", file:"wandering_sue.jpg", rarity:"rare", maxHp:4, ability:"Hidden Weakness", abilityDesc:"If enemy has 12+ HP, destroy them before rolling." },
  { name:"Eloise", file:"eloise.jpg", rarity:"rare", maxHp:5, ability:"Change of Heart", abilityDesc:"Spend 1 Ice Shard to swap HP with enemy before rolling." },
  { name:"Pelter", file:"pelter.jpg", rarity:"rare", maxHp:5, ability:"Snowball", abilityDesc:"Doubles gain +2 damage." },

  // Uncommon
  { name:"Outlaw", file:"outlaw.jpg", rarity:"uncommon", maxHp:5, ability:"Thief", abilityDesc:"Roll doubles: remove 1 opponent die next turn." },
  { name:"Bubble Boys", file:"bubble_boys.jpg", rarity:"uncommon", maxHp:9, ability:"Pop", abilityDesc:"If the enemy rolls triples, Bubble Boys are defeated." },
  { name:"Guard Thomas", file:"guard_thomas.jpg", rarity:"uncommon", maxHp:6, ability:"Stoic", abilityDesc:"Below 6 HP: immune to singles damage." },
  { name:"Bogey", file:"bogey.jpg", rarity:"uncommon", maxHp:5, ability:"Bogus", abilityDesc:"Reflect all incoming damage. Once per game." },
  { name:"Roger", file:"roger.jpg", rarity:"uncommon", maxHp:6, ability:"Tempest", abilityDesc:"Roll 2 pairs of doubles (4+ dice): gain 3 Sacred Fires." },
  { name:"Masked Hero", file:"masked_hero.jpg", rarity:"uncommon", maxHp:5, ability:"Underdog", abilityDesc:"When enemy uses a before-rolling effect: deal 3 damage." },
  { name:"Chad", file:"chad.jpg", rarity:"uncommon", maxHp:6, ability:"Sploop!", abilityDesc:"On entry, gain 2 Ice Shards." },
  { name:"Marcus", file:"marcus.jpg", rarity:"uncommon", maxHp:7, ability:"Glacial Pounding", abilityDesc:"Take 3+ damage: gain 4 extra dice next roll." },
  { name:"Ashley", file:"ashley.jpg", rarity:"uncommon", maxHp:3, ability:"Burning Soul", abilityDesc:"Win a roll: gain 1 Sacred Fire." },
  { name:"Cave Dweller", file:"cave_dweller.jpg", rarity:"uncommon", maxHp:7, ability:"Lurk", abilityDesc:"Deal 3X damage on first roll win." },

  // Common
  { name:"Boo Brothers", file:"boo_brothers.jpg", rarity:"common", maxHp:5, ability:"Teamwork", abilityDesc:"Before rolling, may remove 1 die to gain 1 HP." },
  { name:"Patrick", file:"patrick.jpg", rarity:"common", maxHp:3, ability:"Stone Form", abilityDesc:"Don't roll. If opponent rolls singles: negate damage, deal 3." },
  { name:"Nikon", file:"nikon.jpg", rarity:"common", maxHp:6, ability:"Ambush", abilityDesc:"Win first roll: deal triple damage." },
  { name:"Kodako", file:"kodako.jpg", rarity:"common", maxHp:6, ability:"Swift", abilityDesc:"Roll 1-2-3: negate damage and deal 4 to enemy." },
  { name:"Powder", file:"powder.jpg", rarity:"common", maxHp:5, ability:"Final Gift", abilityDesc:"When defeated, gain 3 Ice Shards for your next ghost." },
  { name:"Simon", file:"simon.jpg", rarity:"common", maxHp:6, ability:"Brew Time", abilityDesc:"When you take damage from a before-the-roll effect, gain 1 Sacred Fire." },
  { name:"Cameron", file:"cameron.jpg", rarity:"common", maxHp:6, ability:"Force of Nature", abilityDesc:"If your damage gets negated, destroy the enemy." },
  { name:"Logey", file:"logey.jpg", rarity:"common", maxHp:6, ability:"Heinous", abilityDesc:"Opponent's 5+ dice are unavailable next roll." },
  { name:"Fredrick", file:"fredrick.jpg", rarity:"common", maxHp:5, ability:"Careful", abilityDesc:"Opponent may only roll up to 3 dice." },
  { name:"Dream Cat", file:"dream_cat.jpg", rarity:"common", maxHp:4, ability:"Jinx", abilityDesc:"Both roll doubles: gain +1 die next turn." },
  { name:"Sad Sal", file:"sad_sal.jpg", rarity:"common", maxHp:5, ability:"Tough Job", abilityDesc:"Lose a roll: gain 1 Ice Shard." },
  { name:"Tommy Salami", file:"tommy_salami.jpg", rarity:"common", maxHp:6, ability:"Regulator", abilityDesc:"Enemy 5's and 6's reroll low. +1 damage per rerolled die if you win." },

  // Legendaries
  { name:"Prince Balatron", file:"balatron.jpg", rarity:"legendary", maxHp:6, ability:"Party Time", abilityDesc:"Lose a roll & survive: roll 1 counter die for damage." },
  { name:"Lucy", file:"lucy.jpg", rarity:"legendary", maxHp:8, ability:"Blue Fire", abilityDesc:"Win a roll: +1 bonus damage." },
  { name:"Romy", file:"romy.jpg", rarity:"legendary", maxHp:8, ability:"Valley Guardian", abilityDesc:"Predict a die number. If any die matches: +3 damage." },
  { name:"The Mountain King", file:"mountain_king_leg.jpg", rarity:"legendary", maxHp:9, ability:"Beast Mode", abilityDesc:"Doubles deal 2X damage." },
  { name:"Shade", file:"shade.jpg", rarity:"legendary", maxHp:5, ability:"Haunt", abilityDesc:"After first roll, opponent takes 1 damage before each roll." },
  { name:"Doom", file:"doom.jpg", rarity:"legendary", maxHp:7, ability:"Fiendship", abilityDesc:"+2 bonus damage!" }
].map(g => ({ ...g, hp: g.maxHp }));
