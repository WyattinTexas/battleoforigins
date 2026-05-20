const SHELVED_IDS = new Set([
  // 204 Finn — active (Forge implemented)

  316, 318, 320, 322, 324, 326, 328, 330, 332, 334, // Penny-Fiddle
  338, 340, 344, 346, 348, 350, 354, 356, 358,       // Thistle-Tadpole
  360,                                                   // The Shepherd
  362, 364, 366,                                       // Bumble, Dusk, Mother Nature — NOT REAL CARDS, DO NOT UNSHELVE
  368,                                                 // Scarecrow King
  317, 319, 321, 323, 325, 329, 331, 333, 335, 337,  // Scorch-Fuego
  339, 341, 347, 349, 351, 353, 355, 357, 359,        // Slag Heap-Volcanic Heart
  361, 363, 367                                        // Ash Phoenix-Dragonclaw
]);

const GHOSTS = [
  {
    id:201, name:"Bouril", rarity:"common", maxHp:10, art:"../testroom/art/old_hank.jpg",
    ability:"Slumber", abilityDesc:"Entry: your first roll is automatically 1-2-3.",
    category:"Defense/Negation", set:"Volcanic Isles",
    designNote:"9 HP tank that starts slow — your first roll is a guaranteed 1-2-3. After that, he's a big body that has to earn his keep."
  },
  {
    id:202, name:"Dark Fang", rarity:"rare", maxHp:5, art:"../testroom/art/originals/DarkFang.png",
    ability:"Pressure", abilityDesc:"While active: enemy Spiritkin cannot heal or gain HP. Win: deal +1 damage for each KO'd Spiritkin this game (both teams).",
    category:"Damage Multiplier", set:"Rolling Hills",
    designNote:"Wolf spirit — Timber's packmate. Forces the opponent to swap their active ghost before rolling. They choose who comes in, but the disruption is brutal. 6 HP keeps him in the fight."
  },
  {
    id:203, name:"Benjamin", rarity:"uncommon", maxHp:3, art:"../testroom/art/benny.jpg",
    ability:"Magic Touch", abilityDesc:"Once per roll: use the Moonstone special without discarding it.",
    category:"Destruction/Instant Kill", set:"Volcanic Isles",
    designNote:"Moonstone economy card. 3 HP is fragile, but his ability to use Moonstones without discarding them makes him incredibly valuable. Protect him and your Moonstones go twice as far."
  },
  {
    id:204, name:"Finn", rarity:"rare", maxHp:6, art:"../testroom/art/finn.png",
    ability:"Forge", abilityDesc:"Sideline & In Play: discard 1 Healing Seed and 1 Sacred Fire to forge the Flame Blade.",
    category:"Resource Generation", set:"Rolling Hills",
    designNote:"Resource conversion is completely empty design space. The cross-set bridge — Frost Valley's economy feeds Volcanic Isles's Moonstone plays. Deckbuilding archetype creator. (Originally named Smithy.)"
  },
  {
    id:205, name:"Shade's Shadow", rarity:"rare", maxHp:1, art:"../testroom/art/kaboom.png",
    ability:"Meltdown", abilityDesc:"Sideline: before each roll, if the enemy active Spiritkin has less than 4 HP, deal 1 damage.",
    category:"Damage Multiplier", set:"Volcanic Isles",
    designNote:"Shade's literal shadow. 1 HP means he dies instantly in battle, but from the sideline he finishes off weakened ghosts. Only triggers when enemy is below 4 HP — a closer, not a chipper."
  },
  {
    id:206, name:"Zain", rarity:"ghost-rare", maxHp:6, art:"../testroom/art/echo.png",
    ability:"Ice Blade", abilityDesc:"Win: gain 1 Ice Shard. Sideline & In Play: discard 1 Ice Shard and 1 Moonstone to forge the Ice Blade.",
    category:"Resource Generation", set:"Volcanic Isles",
    designNote:"Zora-style aquatic being. Smart, cultured, mortal — his people have been in the spirit world a long time, seen Doom, Mountain King, the old threats. Considering: Surge generation, free resource usage, or ice shard passive. One of two water spirits snuck into Volcanic Isles (the other is the whale, Nerina)."
  },
  {
    id:207, name:"Hank", rarity:"common", maxHp:7, art:"../testroom/art/stomper.png",
    ability:"Tremor", abilityDesc:"Each 4 you roll: gain 1 Lucky Stone.",
    category:"Debuff", set:"Volcanic Isles",
    designNote:"Big volcanic Donkey Kong energy. 7 HP brawler who collects Lucky Stones on 4s. Lucky Stones let you reroll a die after any roll — his own mini-economy."
  },
  {
    id:208, name:"Happy Crystal", rarity:"common", maxHp:2, art:"../testroom/art/clover.jpg",
    ability:"Spark Strike", abilityDesc:"Before rolling: you may KO Happy Crystal to gain 1 Moonstone.",
    category:"Resource Generation", set:"Volcanic Isles",
    designNote:"Sacrifice play. 2 HP crystal that you pop for a Moonstone before the opponent can KO it. Timing is everything — use it too early and you waste a slot, too late and it dies for nothing."
  },
  {
    id:209, name:"Dart", rarity:"common", maxHp:3, art:"../testroom/art/swipers.png",
    ability:"Plunder", abilityDesc:"Win: gain 2 Surge.",
    category:"Debuff", set:"Volcanic Isles",
    designNote:"Aggressive volcanic ember. Wins generate 2 Surge — one of the fastest Surge farmers in the game. 5 HP keeps him in the mix."
  },
  {
    id:210, name:"Timber", rarity:"legendary", maxHp:7, art:"../testroom/art/timber.jpg",
    ability:"Howl", abilityDesc:"While Timber is active, before rolling: opponent must choose — discard 2 specials OR remove 1 die for this roll.",
    category:"Debuff", set:"Rolling Hills",
    designNote:"Gary's v4 proposal. Opponent-facing choice mechanic — declining resource trap. Discard 2 specials or roll 2 dice against a 6HP Legendary. No carryover tracking, resolves fresh each roll. 6HP keeps him killable but his ability makes him hard to hit."
  },
  // === NEW CARDS — Rolling Hills ===
  {
    id:301, name:"Dylan", rarity:"common", maxHp:3, art:"../testroom/art/haystack_hank.jpg",
    ability:"Sun Song", abilityDesc:"Sideline & In Play: enemy before-roll effects don't activate. Win: gain 1 Burn.",
    category:"Prediction/Reaction", set:"Rolling Hills",
    designNote:"Sideline utility. Shuts down enemy before-roll effects like Dark Fang's forced swap or Benjamin's free Moonstone. 3 HP scarecrow standing guard."
  },
  {
    id:302, name:"Maximo", rarity:"common", maxHp:4, art:"../testroom/art/toadstool.jpg",
    ability:"Nap", abilityDesc:"Entry: roll only 1 die on your first roll. After each round: gain 1 Healing Seed and 1 Lucky Stone.",
    category:"Defense/Negation", set:"Rolling Hills",
    designNote:"Sleepy mushroom. Starts slow with only 1 die on entry, but generates a Healing Seed every round. 5 HP seed farm — the longer he stays, the richer your team gets."
  },
  {
    id:303, name:"Tweak and Twonk", rarity:"common", maxHp:6, art:"../testroom/art/nugget.jpg",
    ability:"Roaring Crowd", abilityDesc:"Sideline: if your active Spiritkin ties, gain 4 Surge.",
    category:"Resource Generation", set:"Rolling Hills",
    designNote:"The wholesome chunky guy. Ties are ~13% — rare but 4 Surge is a jackpot."
  },
  {
    id:304, name:"The Ember Force", rarity:"uncommon", maxHp:3, art:"../testroom/art/the_flickers.jpg",
    ability:"Swarm", abilityDesc:"Before rolling: deal 1 damage to the enemy active Spiritkin.",
    category:"Dice Modifier", set:"Volcanic Isles",
    designNote:"Little ember preschool. 3 HP but deals 1 guaranteed damage before every roll. Fragile chip damage that adds up fast."
  },
  {
    id:305, name:"Selene", rarity:"legendary", maxHp:6, art:"../testroom/art/luna.jpg",
    ability:"Heart of the Hills", abilityDesc:"Roll Doubles: choose — gain 2 Healing Seeds OR 3 Lucky Stones.",
    category:"Resource Generation", set:"Rolling Hills",
    designNote:"Wyatt's fix for dual-resource problem. Player chooses 1 Healing Seed OR 2 Lucky Stones on doubles (~42%). No more double-dipping — forces a decision between sustain and reroll economy. Selene's creek runs through the hills — Artemis is her messenger."
  },
  {
    id:306, name:"Nerina", rarity:"legendary", maxHp:9, art:"../testroom/art/the_deep.jpg",
    ability:"Leviathan", abilityDesc:"Entry: deal 3 damage to the enemy active Spiritkin.",
    category:"Destruction/Instant Kill", set:"Volcanic Isles",
    designNote:"The legendary ocean titan. Crashes in with 3 entry damage — enough to KO fragile ghosts on arrival. 9 HP means she sticks around after the impact."
  },
  {
    id:307, name:"Artemis", rarity:"rare", maxHp:3, art:"../testroom/art/dewdrop.webp",
    ability:"Daughter of the Stream", abilityDesc:"Win: gain 3 Ice Shards.",
    category:"Resource Generation", set:"Rolling Hills",
    designNote:"Selene's messenger. Zips through the creek delivering resources — win a roll, gain 1 Surge and 1 Ice Shard. Cross-set resource bridge at 3 HP. Rare rarity."
  },
  {
    id:308, name:"Kaplan", rarity:"uncommon", maxHp:5, art:"../testroom/art/honeybun.jpg",
    ability:"Pollinate", abilityDesc:"When opponent rolls Doubles: gain 1 Healing Seed.",
    category:"Debuff", set:"Rolling Hills",
    designNote:"Honey floop and Selene's pollinator. When the opponent rolls doubles (~42%), you gain a Healing Seed. Passive, reliable generation at 4 HP."
  },
  {
    id:309, name:"Aunt Susan", rarity:"uncommon", maxHp:4, art:"../testroom/art/rustler.jpg",
    ability:"Harvest Dance", abilityDesc:"Discard 1 Healing Seed: deal +2 damage. Win: gain 2 Healing Seeds.",
    category:"Damage Multiplier", set:"Rolling Hills",
    designNote:"The autumn whirlwind. Builds momentum like Caldera but resets on ANY loss, not just when you deal damage. Higher risk, different rhythm."
  },
  {
    id:310, name:"Granny", rarity:"uncommon", maxHp:3, art:"../testroom/art/granny.jpg",
    ability:"Bedtime Story", abilityDesc:"Sideline: when one of your Spiritkin is defeated — by Singles: gain 3 Lucky Stones. By Doubles: gain 1 Moonstone. By Triples or better: gain 3 Sacred Fires.",
    category:"HP Recovery", set:"Rolling Hills",
    designNote:"The porch reader. Gentle passive healing from the sideline. Max 2 keeps it within the healing cap rule. v637 buff (Wyatt 2026-04-11): singles KO now grants 2 Lucky Stones (was 1) — rewards the most common KO type."
  },
  {
    id:311, name:"Pudge", rarity:"common", maxHp:7, art:"../testroom/art/pudge.webp",
    ability:"Belly Flop", abilityDesc:"Doubles: deal +2 damage. After damage is applied, you take 1 damage.",
    category:"Damage Multiplier", set:"Rolling Hills",
    designNote:"Big chunky swamp toad. High HP makes the self-damage manageable. Doubles are 41.7% — fires often for a brawler."
  },
  {
    id:312, name:"Timpleton", rarity:"uncommon", maxHp:4, art:"../testroom/art/lurk.jpg",
    ability:"Big Target", abilityDesc:"Win: deal +3 damage if the enemy Spiritkin's HP is higher than Timpleton's.",
    category:"Damage Multiplier", set:"Rolling Hills",
    designNote:"The swamp shadow. v640 rework (Wyatt 2026-04-11): was an Entry strike (automatic 3 damage on entry if enemy HP > his), now a Win-roll damage multiplier. Must actually win the roll to collect the +3. Keeps the 'punching up' fantasy without the free-damage ambush."
  },
  {
    id:313, name:"Sylvia", rarity:"rare", maxHp:4, art:"../testroom/art/ripple.jpg",
    ability:"Porpoise", abilityDesc:"Ice Shards cost nothing to commit. When you lose a roll: roll 1 die. If you roll a 5 or 6, negate all damage.",
    category:"Defense/Negation", set:"Volcanic Isles",
    designNote:"The porpoising dodger. RNG defense that creates incredible drama — will the dodge happen? 30% is enough to matter without being broken."
  },
  {
    id:314, name:"Farmer Jeff", rarity:"ghost-rare", maxHp:5, art:"../testroom/art/farmer_jeff.jpg",
    ability:"Harvest", abilityDesc:"Sideline & In Play: gain 1 Healing Seed for each 6 you roll.",
    category:"Resource Generation", set:"Rolling Hills",
    designNote:"The 4th Jeff. Farm life suits him — hardworking, reliable, always producing. Named synergy with Jeffery (Chuckle) for a wholesome sideline duo. v636 buff (Wyatt 2026-04-11): no longer requires the active ghost to win — any 6 rolled produces a seed, win or lose."
  },
  {
    id:315, name:"Harrison", rarity:"rare", maxHp:7, art:"../testroom/art/moonreach.jpg",
    ability:"Ascend", abilityDesc:"Discard Healing Seeds: roll 1 extra die per seed discarded.",
    category:"Defense/Negation", set:"Rolling Hills",
    designNote:"The hilltop moonlight spirit. Her one moment of reaching the moon grants a Moonstone — but only late game. The card that turns a losing game around."
  },
  // === ROLLING HILLS — Designed Cards ===
  {id:316, name:"Penny", art:"../testroom/art/penny.webp", rarity:"common", maxHp:4, ability:"Forager", abilityDesc:"Win: gain 1 Healing Seed.", category:"Resource Generation", set:"Rolling Hills", designNote:"Basic Healing Seed generator."},
  {id:318, name:"Magnolia", rarity:"uncommon", maxHp:5, ability:"Bloom", abilityDesc:"Spend 1 Healing Seed: your active ghost gains +2 damage this round.", category:"Damage Multiplier", set:"Rolling Hills", designNote:"Healing Seeds as offensive fuel."},
  {id:320, name:"Bramble", art:"../testroom/art/bramble.webp", rarity:"common", maxHp:3, ability:"Thorn Wall", abilityDesc:"Entry: opponent takes 1 damage next round.", category:"Debuff", set:"Rolling Hills", designNote:"Thorny entry punisher."},
  {id:322, name:"Old Mill", art:"../testroom/art/old_mill.webp", rarity:"rare", maxHp:6, ability:"Grindstone", abilityDesc:"Spend 1 Surge + 1 Surge: gain 1 Moonstone.", category:"Resource Generation", set:"Rolling Hills", designNote:"Ultimate resource converter. Cross-set bridge."},
  {id:324, name:"Biscuit", art:"../testroom/art/biscuit.webp", rarity:"common", maxHp:5, ability:"Warm Up", abilityDesc:"Sideline: your active ghost gains +1 HP on wins. Cannot exceed max.", category:"HP Recovery", set:"Rolling Hills", designNote:"Gentle healer with no-overclock rule."},
  {id:326, name:"Barnaby", art:"../testroom/art/barnaby.webp", rarity:"uncommon", maxHp:5, ability:"Stubborn", abilityDesc:"Cannot be swapped out by opponent effects. Immune to forced switches.", category:"Defense/Negation", set:"Rolling Hills", designNote:"Anti-Winston, anti-Gus, anti-Raditz."},
  {id:328, name:"Drizzle", art:"../testroom/art/drizzle.webp", rarity:"common", maxHp:4, ability:"Rain Dance", abilityDesc:"Both players reroll all 1s. Free.", category:"Dice Modifier", set:"Rolling Hills", designNote:"Neutral reroll chaos."},
  {id:330, name:"Snoozer", art:"../testroom/art/snoozer.webp", rarity:"common", maxHp:3, ability:"Nap Time", abilityDesc:"Sideline: if no damage is dealt in a round, gain 1 Surge.", category:"Resource Generation", set:"Rolling Hills", designNote:"Rewards peaceful rounds."},
  {id:332, name:"Grandmother Willow", art:"../testroom/art/grandmother_willow.webp", rarity:"ghost-rare", maxHp:7, ability:"Deep Roots", abilityDesc:"Cannot be KO'd by singles damage. Must be defeated by doubles or triples.", category:"Defense/Negation", set:"Rolling Hills", designNote:"Ultimate tank vs weak hits."},
  {id:334, name:"Fiddle", art:"../testroom/art/fiddle.webp", rarity:"uncommon", maxHp:6, ability:"Hoedown", abilityDesc:"Win: you may swap your active Spiritkin without triggering Stomper/Crag effects.", category:"Prediction/Reaction", set:"Rolling Hills", designNote:"Safe swap enabler. Counters Stomper."},
  {id:336, name:"Humar", art:"../testroom/art/humar.jpg", rarity:"legendary", maxHp:5, ability:"Meteor", abilityDesc:"Win: opponent takes 2 damage before their next roll. Gain 1 Burn.", category:"Damage Multiplier", set:"Volcanic Isles", designNote:"The blue flame legend. REWORKED 2026-04-12: swapped from Sacred Fire gen to Lucy's old delayed-damage + Burn mechanic, buffed from 1 to 2 damage. Renamed from Sacred Flame to Meteor. HP reduced 8→5 to balance the offensive power."},
  {id:338, name:"Thistle", art:"../testroom/art/thistle.webp", rarity:"rare", maxHp:7, ability:"Barbed", abilityDesc:"When you take damage: the attacker takes 1 damage back. Always.", category:"Defense/Negation", set:"Rolling Hills", designNote:"Passive permanent thorns."},
  {id:340, name:"Cluck", art:"../testroom/art/cluck.webp", rarity:"common", maxHp:5, ability:"Peck", abilityDesc:"Win with singles: deal +2 damage.", category:"Damage Multiplier", set:"Rolling Hills", designNote:"Simple singles booster."},
  {id:342, name:"Calvin", art:"../testroom/art/mossy.webp", rarity:"uncommon", maxHp:5, ability:"Overclock", abilityDesc:"Win: gain 1 HP (can exceed max HP). Gain 1 Healing Seed.", category:"HP Recovery", set:"Rolling Hills", designNote:"Overclocking healer. HP grows beyond max on wins. Snowballs if unchecked."},
  {id:344, name:"Wisp", art:"../testroom/art/wisp.webp", rarity:"common", maxHp:4, ability:"Guide Light", abilityDesc:"Sideline: opponent cannot gain resources this round.", category:"Debuff", set:"Rolling Hills", designNote:"Resource denial from sideline."},
  {id:346, name:"Harvest Moon", art:"../testroom/art/harvest_moon.webp", rarity:"rare", maxHp:6, ability:"Reaping", abilityDesc:"Defeat a ghost: gain 1 of every resource (Healing Seed, Surge, Surge).", category:"Resource Generation", set:"Rolling Hills", designNote:"The harvest payoff."},
  {id:348, name:"Mulch", art:"../testroom/art/mulch.webp", rarity:"common", maxHp:3, ability:"Decompose", abilityDesc:"When defeated: your team gains 2 Healing Seeds.", category:"Resource Generation", set:"Rolling Hills", designNote:"Death trigger resource gen."},
  {id:350, name:"Silo", art:"../testroom/art/silo.webp", rarity:"uncommon", maxHp:6, ability:"Stockpile", abilityDesc:"Sideline: at end of each round, store 1 copy of any resource your team gained.", category:"Resource Generation", set:"Rolling Hills", designNote:"Resource doubler from sideline."},
  {id:352, name:"Jimmy", art:"../testroom/art/cricket.webp", rarity:"common", maxHp:2, ability:"Chirp", abilityDesc:"Sideline & In Play: on a tie, gain 3 Lucky Stones and 1 Magic Firefly.", category:"Resource Generation", set:"Rolling Hills", designNote:"Mutual benefit on ties. Fires from sideline AND in play. Nerfed 7→5 Lucky Stones, added 1 Magic Firefly."},
  {id:354, name:"Patches", art:"../testroom/art/patches.webp", rarity:"uncommon", maxHp:5, ability:"Quilt", abilityDesc:"Spend 2 Healing Seeds: negate all damage this round.", category:"Defense/Negation", set:"Rolling Hills", designNote:"Resource-powered shield."},
  {id:356, name:"Riverbed", art:"../testroom/art/riverbed.webp", rarity:"rare", maxHp:7, ability:"Current", abilityDesc:"Sideline: if opponent rolls doubles, force them to reroll one die.", category:"Dice Modifier", set:"Rolling Hills", designNote:"Anti-doubles from sideline."},
  {id:358, name:"Tadpole", art:"../testroom/art/tadpole.webp", rarity:"common", maxHp:5, ability:"Splash", abilityDesc:"Entry: gain 1 Surge.", category:"Resource Generation", set:"Rolling Hills", designNote:"Simple entry resource gen."},
  {id:360, name:"The Shepherd", art:"../testroom/art/the_shepherd.webp", rarity:"legendary", maxHp:8, ability:"Flock", abilityDesc:"Your defeated ghosts return to sideline with 1 HP. Once Per Game.", category:"HP Recovery", set:"Rolling Hills", designNote:"Team-wide resurrection. Once per game."},
  {id:362, name:"Bumble", art:"../testroom/art/bumble.webp", rarity:"uncommon", maxHp:6, ability:"Pollinate", abilityDesc:"Win: give 1 Healing Seed to opponent. But gain 2 yourself.", category:"Resource Generation", set:"Rolling Hills", designNote:"Net positive gen that feeds opponent too."},
  {id:364, name:"Dusk", art:"../testroom/art/dusk.webp", rarity:"uncommon", maxHp:4, ability:"Twilight", abilityDesc:"After round 5: all your damage gains +1.", category:"Damage Multiplier", set:"Rolling Hills", designNote:"Late-game scaling."},
  {id:366, name:"Mother Nature", art:"../testroom/art/mother_nature.webp", rarity:"legendary", maxHp:8, ability:"Seasons", abilityDesc:"Each round cycles: Spring (+1 HP), Summer (+1 dmg), Autumn (+1 resource), Winter (opponent -1 die).", category:"Prediction/Reaction", set:"Rolling Hills", designNote:"The legendary. Predictable but unstoppable cycle."},
  {id:368, name:"Scarecrow King", art:"../testroom/art/scarecrow_king.webp", rarity:"rare", maxHp:4, ability:"Command", abilityDesc:"Sideline: all your other sideline ghosts' abilities trigger twice.", category:"Prediction/Reaction", set:"Rolling Hills", designNote:"Sideline amplifier. Low HP if forced to fight."},
  // === WYATT APRIL 11 2026 STAGING (IDs 407-431) — GALLERY ONLY, NO BATTLE LOGIC ===
  // These 25 cards (12 Volcanic Isles + 13 Rolling Hills) were designed by the cards
  // agent overnight. abilityDesc is written but NO handlers, entry effects, or sideline
  // checks exist for any of these IDs. Wyatt designs battle logic next session.
  // Refiner: DO NOT IMPLEMENT abilities for IDs 407-431 until Wyatt explicitly approves.
  {id:409, name:"Nick & Knack", rarity:"common", maxHp:4, art:"../testroom/art/originals/Cindergrub.png", ability:"Knick Knack", abilityDesc:"Before rolling: you may steal 1 special from the other player. If you do, gain 1 HP and 2 Burn.", category:"Disruption", set:"Rolling Hills", tags:["Final 50"], designNote:"Twin glowing green tunnel-worms. Pre-roll steal → +1 HP + 2 Burn (was +3 HP)."},
  {id:410, name:"Mirror Matt", rarity:"common", maxHp:1, art:"../testroom/art/originals/MirrorMatt.png", ability:"Seven Years", abilityDesc:"If the opponent wins with Doubles: reflect all damage to the attacker.", category:"Defense/Negation", set:"Dark Castle", tags:["Final 50"], designNote:"A being made of obsidian volcanic glass — impossibly beautiful, impossibly sharp. Big burst damage but punishes itself on every win. At 3HP the self-damage is genuinely consequential. Wyatt flag: combined with other VA self-damage sources (Wick, Glass Fang loops) this could snowball; worth watching. Art direction: a translucent jet-black glass creature with razor edges catching lava-light like a prism, ethereal and beautiful, backlit in deep orange."},
  {id:413, name:"Sable", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/ObsidianEel.png", ability:"Furnace", abilityDesc:"Sideline & In Play: roll all odd numbers, gain 1 Sacred Fire.", category:"Resource Generation", set:"Volcanic Isles", tags:["Final 50"], designNote:"A long sinuous being made of polished black volcanic glass that swims through lava streams — beautiful and alien. Doubles → Moonstone (~44% trigger on wins) creates the first real Moonstone generation engine in VA. Synergizes with Fluxling: nudge dice into doubles, Eel refills the Moonstone you spent nudging. Art direction: a sleek eel of polished obsidian glass, semi-transparent, cool blue-white glow pulsing along its spine, slow and hypnotic."},
  {id:414, name:"Chow", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Chow.png", ability:"Secret Ingredient", abilityDesc:"Before rolling: spend 1 Healing Seed to gain 2 extra dice this roll.", category:"Dice Modifier", set:"Dark Castle", tags:["Final 50"], designNote:"THE cozy card of Volcanic Isles. A stubby little mole who has lived underground in the lava tubes for so long it radiates warmth and contentment. Modest entry Healing Seed — not flashy, just warm and helpful. Bridges VA into cross-set Healing Seed strategies. The card that makes players go 'aww' before dropping it. Art direction: a plump mole with velvety ashen-grey fur, tiny pink claws, eyes glowing like embers, wears a small dirt-stained waistcoat, peering up from a tunnel mouth."},
  {id:415, name:"Nyx & Bessie", rarity:"common", maxHp:6, art:"../testroom/art/originals/NyxAndBessie.png", ability:"Moo! Caw!", abilityDesc:"Sideline: gain 4 Healing Seeds when you defeat a Spiritkin.", category:"Resource Generation", set:"Rolling Hills", tags:["Final 50"], designNote:"Cow + crow duo. Wyatt's Photoshop original 2026-04-11. A white-faced cow with antlers and a perched crow — farmstead spirits of the Rolling Hills. Sideline payoff: KO an enemy ghost and Nyx & Bessie drop 3 Healing Seeds into your lap. Big burst but requires a kill — parallels Bo's Miracle as a KO-triggered payoff at common rarity. 6HP is generous for a common but justified since sideline-only ability means HP is rarely tested."},
  {id:416, name:"Rook", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/Pyroclast.png", ability:"Charcoal", abilityDesc:"Immune to Sacred Fire and Burn damage. Win: deal +1 damage per Surge committed this roll.", category:"Damage Multiplier", set:"Volcanic Isles", tags:["Final 50"], designNote:"Born from eruption itself — a jagged lava fragment given explosive, furious life. REWORKED 2026-04-11: Surge-conversion payoff + full Sacred Fire immunity. Every Surge committed before rolling becomes +1 damage on a winning roll; incoming enemy Sacred Fire damage does nothing to him. Hard counter to Tyler/Humar/Pyroclast-style Sacred Fire damage stackers on the opposing side. Lore: he's made of the thing, the fire doesn't burn him. Art: manic cartoon lava-rock creature with wild eyes, mid-eruption on a volcanic ridge, toothy grin."},
  {id:417, name:"Twyla", rarity:"rare", maxHp:6, art:"../testroom/art/originals/Hesta.png", ability:"Lucky Dance", abilityDesc:"Each Lucky Stone you spend adds +1 die and +1 damage.", category:"Dice Modifier", set:"Rolling Hills", tags:["Final 50"], designNote:"Moonlight dancer twirling above a reflecting pool. Lucky Stones used for rerolls during the turn gain a second payoff IF Twyla wins: each stone spent adds +1 damage to the hit AND +1 HP healed. Spend 3 Lucky Stones on rerolls, win the roll, deal +3 bonus damage and heal 3 HP. The dance rewards commitment — the more stones you burn chasing the win, the bigger the payoff when you get it. Pairs with Hedgeling (Healing Seed → Lucky Stone pipeline) and any Lucky Stone generator. Art: blue moonlight spirit dancer under crescent moon."},
  {id:418, name:"Pip", rarity:"ghost-rare", maxHp:7, art:"../testroom/art/originals/Pip.png", ability:"Toasted", abilityDesc:"Triples or better: permanently remove 1 die from your opponent. Pip gains 2 Sacred Fires. Once Per Game.", category:"Damage Multiplier", set:"Volcanic Isles", tags:["Final 50"], designNote:"THE one. A tiny ember dragon who passed away mid-giggle while doing a delighted spin-jump near a hot geyser. The ghost still does the spin. Cannot stop. Genuinely does not understand death and has no plans to start. The +1 on all wins is the reliable floor; the triples payoff (+3 damage + 2HP from sheer joy) is the unforgettable jackpot at 2.8% — rare but legendary when it lands. NOT Dragonclaw. Dragonclaw rakes. Pip giggles. Mandatory holo foil. Midjourney art direction: tiny translucent ember dragon ghost mid-loop-de-loop, wings spread in delight, open-mouthed giggle with tiny smoke puffs from nostrils, surrounded by floating warm sparks, Spiritkin ghost transparency, warm orange-gold backlight, pure JOY."},
  {id:419, name:"Boopies", rarity:"common", maxHp:3, art:"../testroom/art/originals/Hedgeling.png", ability:"Boopie Magic", abilityDesc:"Sideline: whenever your active Spiritkin spends a Healing Seed, gain 1 Lucky Stone.", category:"Resource Generation", set:"Rolling Hills", tags:["Final 50"], designNote:"A tiny sprite that lives inside the hedgerows between fields — you can only see it if you know to look. Passive synergy that rewards Healing Seed builds: every seed spent also generates luck. Combos with Chester, Gourdling, Beewick, and The Overcast naturally. Art direction: a 6-inch figure peering through a gap in a thorny green hedgerow, mossy green skin, bright curious eyes, small acorn cap, nearly invisible against the hedge."},
  {id:420, name:"Lars", rarity:"common", maxHp:4, art:"../testroom/art/originals/Gourdling.png", ability:"Light the Way", abilityDesc:"Entry: gain 1 Surge, 1 Lucky Stone, and 1 Burn.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"A pumpkin-spirit — round, orange, genuinely delighted by autumn. Entry 2 Healing Seeds is a resource burst that fuels The Overcast, Magnolia, Beewick, and Chester combos. Feels like opening a harvest basket. Pairs naturally with any Healing Seed payoff card. Art direction: a round gently glowing jack-o-lantern creature with an authentically HAPPY carved expression (not spooky — joyful), autumn leaves orbiting it, warm amber light from within."},
  {id:423, name:"Zippa", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Beewick.png", ability:"Glimmer", abilityDesc:"Deal +1 damage for each Healing Seed you hold.", category:"Damage Multiplier", set:"Rolling Hills", tags:["Final 50"], designNote:"Beekeeper spirit. Reworked: passive +1 damage per Healing Seed held. Rewards stacking seeds. Hard synergy with Chester and Gourdling."},
  {id:424, name:"Bigsby", rarity:"rare", maxHp:5, art:"../testroom/art/originals/Digby.png", ability:"Omen", abilityDesc:"Win: deal +1 damage. If you use a Moonstone, transform into Doom.", category:"Damage Multiplier", set:"Dark Castle", tags:["Final 50"], designNote:"A mole farmer who has dug through enough hills to know exactly where the shiny things are. Moonstone on entry is clean uncommon-level power — fuels any Moonstone strategy, bridges RH into the Fluxling/Obsidian Eel VA cross-play, and rewards deckbuilders who value die control. Art direction: a stout mole in a dirt-stained work vest, holding a discovered moonstone triumphantly, still has mud on his snout, enormously pleased with himself."},
  {id:426, name:"Chester", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Chester.png", ability:"Well Read", abilityDesc:"Win: gain 1 Healing Seed. Win with Doubles or better: also gain 2 Burn.", category:"Resource Generation", set:"Rolling Hills", tags:["Final 50"], designNote:"Cheese-cellar dweller. Reworked: always gets 1 Healing Seed on win. Doubles+ also grants 2 Burn (was 1 Burn instead of seed)."},
  {id:427, name:"Garrick", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Brock.png", ability:"Watchfire", abilityDesc:"Lose: take -1 damage. Defeat a Spiritkin: gain 1 Sacred Fire.", category:"Defense/Negation", set:"Dark Castle", tags:["Final 50"], designNote:"The rolling hills' unofficial guardian — a badger, specifically. 'Brock' is the old English name for badger. The sett is the stable center of any field. Win or lose, Brock cushions every exchange: hits harder when ahead, takes less when behind. Reliable two-way modifier on a 6HP body. Works as a fighter or a bench presence that makes your active ghost feel safer. Art direction: a dignified badger in a dark well-worn coat, standing on a hillside at dusk, protective expression, white stripe catching the last light."},
  {id:428, name:"Jasper", rarity:"rare", maxHp:5, art:"../testroom/art/originals/Pickwick.png", ability:"Flame Dive", abilityDesc:"Win: roll 1 bonus die. Deal its value as additional damage. Jasper takes 1 damage.", category:"Damage Multiplier", set:"Rolling Hills", tags:["Final 50"], designNote:"The ghost of a joyful wanderer who never stopped moving in life and hasn't stopped in death either. Entry resource burst — one of each immediately usable resource (no Sacred Fire keeps it balanced). 6HP means he can fight, not just be hit-and-swap. RH's merchant hero. Wyatt flag: Pickwick + The Shepherd resurrection loop could refuel resources repeatedly — worth testing. Art direction: a round happy wanderer in a well-worn travelling coat, bulging pack slung over one shoulder, big grin, glowing footsteps trailing behind him on a rolling hill path."},
  {id:429, name:"Young Cap", rarity:"uncommon", maxHp:4, art:"../testroom/art/originals/OldCap.png", ability:"Energize", abilityDesc:"Before rolling: when you use a Healing Seed, also gain 1 extra die, 1 Ice Shard, and 1 Surge this roll.", category:"Dice Modifier", set:"Rolling Hills", tags:["Final 50"], designNote:"An ancient mushroom spirit — slow, unremarkable, deeply wise, and quietly spectacular at the very end. The death trigger creates a genuine sacrifice archetype: deliberately send Old Cap into danger, let it die, empower the next ghost with an HP surge. Risk-reward deckbuilding that rewards planning. +3HP overclocks per Gary's rules. Art direction: a large ancient mushroom cap creature in earthy browns and mossy greens, face like a very old tree, slowly releasing spores as it begins to fade, gentle and warm, not dramatic — just quietly complete."},
  {id:430, name:"Gordok", rarity:"uncommon", maxHp:8, art:"../testroom/art/originals/Millicent.png", ability:"River Terror", abilityDesc:"Win: you may take 2 specials from your opponent instead of dealing damage. Gain 1 extra die next roll and 1 Moonstone.", category:"Disruption", set:"Rolling Hills", tags:["Final 50"], designNote:"The cunning folk of the Rolling Hills — hedge-witch, wise-woman, someone you bring a pie to before you bring a problem. Moonstone-powered full information + theft: see everything they have, take the worst thing for them to lose. Spending Moonstone (rare resource) for information and theft is elegant. Active, decisive, satisfying for the person playing it. Art direction: a sharp-eyed older woman-shaped figure in a patchwork cloak, standing at a fork in the hill paths, wisps of blue-grey smoke curling from her hands, deeply knowing expression — she already knows what you're going to say."},
  {id:431, name:"Pal Al", rarity:"ghost-rare", maxHp:3, art:"../testroom/art/originals/TheOvercast.png", ability:"Squall", abilityDesc:"Win: you may gain 4 Ice Shards instead of dealing damage.", category:"Resource Generation", set:"Rolling Hills", tags:["Final 50"], designNote:"A massive cumulus giant that drifts silently above the Rolling Hills, paying tribute to the Mountain King above the peaks. THE payoff card for the entire RH Healing Seed economy — converts accumulated seeds into a single devastating hit. With 4 Healing Seeds banked: a win deals 2 base + 8 bonus = 10 damage. With zero seeds: no bonus (player decides how much to spend). Ghost-rare holo treatment on a cloud texture will look extraordinary. Lore: The Mountain King commands the cloud giants to watch the hills. The Overcast is the oldest and most loyal. Slightly somber, enormous, warm when you look closely. Midjourney art direction: a massive cumulus cloud ghost floating above rolling green hills at golden hour, enormous white-grey body with a face of deep weather-patience, subtle crown of static-grey stormclouds on its head, smaller clouds orbiting it like attendants, Spiritkin ghost aesthetic, distant mountain peaks visible on the horizon with the Mountain King's presence implied, warm and huge and ancient."},
  {id:432, name:"Valkin the Grand", rarity:"legendary", maxHp:8, art:"../testroom/art/originals/ValkinTheGrand.png", ability:"Grand Spoils", abilityDesc:"KO an enemy Spiritkin: gain 1 Sacred Fire, 2 Ice Shards, 1 Frostbite, 1 Moonstone, 2 Healing Seeds.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"THE ANTAGONIST LEGENDARY. Valkin the Grand is the main villain of the BOO: Battle of Origins lore — the tyrant who trapped Toby's grandfather and seeks to control the BOO itself. Grand Spoils embodies his greed: every KO pays him the full resource suite. 6 HP is modest-legendary so the snowball has to be earned. Art: Gemini-generated regal spirit monarch on a blue-flame throne. v837 audit: former Vela resurrection hook fully removed — index.html resolves Grand Spoils at line 16724, smartAutoPlay.js cleaned in v672. No dangling Vela refs remain."},
  {id:433, name:"Lucas", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Vigil.png", ability:"Kindling", abilityDesc:"Sideline: when a Spiritkin is revived, it charges into play with +3 HP and +1 die next roll. The reviver steps to the sideline.", category:"Resource Generation", set:"Volcanic Isles", tags:["Final 50"], designNote:"Resurrection payoff #2. Flame-family Spiritkin: humanoid body, orange-red torchflame head, flame-orange accessories. Triggers on any resurrection source. 6 Sacred Fires = +18 committed damage on the next winning roll. Pairs with any resurrection source (Bo 109, The Shepherd 360 when implemented)."},
  {id:435, name:"Willow", rarity:"ghost-rare", maxHp:4, art:"../testroom/art/originals/Willow.png", ability:"Joy of Painting", abilityDesc:"Sideline & In Play: gain 1 extra die if you lost the last roll.", category:"Dice Modifier", set:"Dark Castle", tags:["Final 50"], designNote:"A ghost painter at her easel by a moonlit window. Paints through the night, finds joy in every loss. The comeback mechanic — every defeat fuels the next roll. Bob Ross energy meets Dark Castle. 4HP ghost-rare, fragile but inspiring."},
  {id:436, name:"Princess Shade", rarity:"rare", maxHp:4, art:"../testroom/art/originals/PrincessShade.png", ability:"Bounty", abilityDesc:"Sideline & In Play: when the enemy Spiritkin takes damage before the roll, deal +1 additional damage.", category:"Damage Multiplier", set:"Dark Castle", tags:["Final 50"], designNote:"A dark elegant apparition ascending a grand staircase in a golden-lit castle atrium. Long flowing shadow-form dissolving at the edges. Regal, haunting, beautiful. The princess of the Dark Castle."},
  {id:437, name:"Rascals", rarity:"common", maxHp:3, art:"../testroom/art/originals/Rascals.png", ability:"Stampede", abilityDesc:"Entry: gain 3 Burn.", category:"Disruption", set:"Dark Castle", tags:["Final 50"], designNote:"Four tiny colorful imp fiends — purple, red, orange, blue — racing through a gorgeous ornate castle hallway. Pure chaos energy. A pack card. The common troublemakers of the Dark Castle."},
  {id:445, name:"Michael", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/WaterSpirit.png", ability:"Torrent", abilityDesc:"Even Doubles: deal +2 damage. While In Play, your sideline Spiritkin are immune to Burn.", category:"Dice Modifier", set:"Volcanic Isles", tags:["Final 50"], designNote:"Blue water spirit leaping joyfully in front of a waterfall. Frost Valley energy."},
  {id:446, name:"Mable Stadango", rarity:"rare", maxHp:5, art:"../testroom/art/originals/ForestSpirit.png", ability:"Hex", abilityDesc:"When you place Burn on an enemy Spiritkin, remove 1 enemy die next roll. Win: gain 1 Burn.", category:"Disruption", set:"Rolling Hills", tags:["Final 50"], designNote:"Hooded spirit with glowing green eyes. In play only. Burn-placement → -1 enemy die. Win → +1 Burn."},
  {id:447, name:"Professor Hawking", rarity:"rare", maxHp:2, art:"../testroom/art/originals/ProfessorHawking.png", ability:"Wisdom", abilityDesc:"While active: gain 2 extra dice if you are holding a Moonstone.", category:"Dice Modifier", set:"Rolling Hills", tags:["Final 50"], designNote:"Pixel art ghost owl reading a golden book on a tree branch at sunset. Wise, scholarly, charming."},
  {id:448, name:"Harvey", rarity:"ghost-rare", maxHp:6, art:"../testroom/art/originals/TreeMonster.png", ability:"Harvest Moon", abilityDesc:"Win: deal +1 damage for each 5 you rolled. If you rolled any 5s, gain 1 Moonstone.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"Massive dark tree creature with a wide glowing grin and moonlight orb. Menacing but charming. Tank energy."},
  {id:444, name:"Goobs", rarity:"common", maxHp:4, art:"../testroom/art/originals/GoobParty.png", ability:"Dance Party", abilityDesc:"Sideline & In Play: on a tie, both players gain 1 Magic Firefly. Your active Spiritkin gains 5 HP.", category:"Resource Generation", set:"Rolling Hills", tags:["Final 50"], designNote:"A field full of tiny green blobs dancing under a moonlit sky. The happiest, dumbest card in the game. Ties become resource explosions for both sides. 2HP because the Goobs die if you look at them wrong. Pure party energy."},
  {id:443, name:"Captain James", rarity:"rare", maxHp:6, art:"../testroom/art/originals/DCKnight.png", ability:"Final Strike", abilityDesc:"Sideline & In Play: Triples or better: gain 2 Sacred Fires.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"Tall flame-headed Spiritkin knight. Sideline & In Play: triples+ → 2 Sacred Fires."},
  {id:442, name:"Castle Gardener", rarity:"common", maxHp:2, art:"../testroom/art/originals/Gardener.png", ability:"Cultivate", abilityDesc:"Before rolling: you may discard Healing Seeds to gain 2 Sacred Fire each.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"A tiny innocent spirit with a watering can tending glowing crystal flowers in a secret castle garden. Converts Healing Seeds into Sacred Fire — the garden fuels the flames. 2HP glass cannon resource converter."},
  {id:440, name:"Gom Gom Gom", rarity:"common", maxHp:5, art:"../testroom/art/originals/DCFlameball.png", ability:"Chaos", abilityDesc:"Win with Doubles: gain 1 Sacred Fire.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"Angry blue flame ball fiend in a castle corridor. Jagged teeth, menacing glow. Classic Dark Castle common."},
  {id:441, name:"Wendy", rarity:"rare", maxHp:3, art:"../testroom/art/originals/DCMoonDragon.png", ability:"Moonbeam", abilityDesc:"Win with Doubles or better: gain 1 Magic Firefly.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"Cute pale lavender dragon floating by a full moon over castle spires. Gentle, beautiful, moonlit. Dark Castle rare."},
  {id:439, name:"Lucy's Shadow", rarity:"rare", maxHp:4, art:"../testroom/art/originals/LucysShadow.png", ability:"Mentor", abilityDesc:"Sideline: while Lucy is In Play, Lucy gains 1 extra Sacred Fire on wins and her Sacred Fires deal double damage.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"A dark contemplative dragon-spirit sitting in a castle archway, devoted to Lucy's blue fire. Doubles Lucy's Sacred Fire output from the bench. The loyal shadow that amplifies the queen."},
  {id:438, name:"Champ", rarity:"ghost rare", maxHp:5, art:"../testroom/art/originals/Champ.png", ability:"Thrill", abilityDesc:"Immune to damage from Specials. Gain 1 Surge when you or the enemy rolls Doubles or better.", category:"Defense/Negation", set:"Dark Castle", tags:["Final 50"], designNote:"A hulking blue-grey flame beast with orange fire mane standing in a grand cathedral hall. Fierce fanged grin, powerful stance. The mid-tier brawler of Dark Castle. Watercolor meets Pokemon Gengar energy."},
  // === CARPENTER / WELDER / FOREMAN — Blue-Collar Evolution Chain ===
  {id:449, name:"Carpenter", rarity:"common", maxHp:4, art:"../testroom/art/originals/Carpenter.png", ability:"Crafty", abilityDesc:"Win: +2 damage on Singles. If you use a Surge, transform into Welder. Gain the Hammer.", category:"Evolution", set:"Volcanic Isles", tags:["Final 50"], designNote:"Blue-collar evolution chain entry. Simple, honest, hits hard on singles. The dad card. Transforms via surge commit, leaving behind a permanent +2 singles powerup (Carpenter's Hammer). Art: Spiritkin working on an old rocking chair in a warm workshop."},
  {id:450, name:"Welder", rarity:"rare", maxHp:5, art:"../testroom/art/originals/Welder.png", ability:"Flux", abilityDesc:"Win: gain 1 Burn. Roll a 4: transform into Foreman. Gain the Torch.", category:"Evolution", set:"Volcanic Isles", tags:["Final 50"], designNote:"Mid-evolution. Burn specialist with welding mask energy. Transforms on rolling a 4 — the skilled tradesman graduating to management. Leaves behind Welder's Torch as permanent item. Art: Spiritkin with welding mask shooting sparks upward like a cowboy."},
  {id:451, name:"Foreman", rarity:"rare", maxHp:5, art:"../testroom/art/originals/Foreman.png", ability:"Blueprint", abilityDesc:"Win: +1 die next roll.", category:"Evolution", set:"Volcanic Isles", tags:["Final 50"], designNote:"End of the blue-collar chain. By this point you have Carpenter's Hammer (+2 singles) and Welder's Torch (burns +1, wins give burn) both active. Foreman snowballs dice on wins. The boss. Art: Spiritkin leaning over blueprints, detective-show 'I've had it up to here' energy."},
  {id:452, name:"Ripagoo", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Ripagoo.png", ability:"Chemical Y", abilityDesc:"Sideline: if a Spiritkin In Play transforms, gain 2 Burn.", category:"Resource Generation", set:"Volcanic Isles", tags:["Final 50"], designNote:"Sideline observer that feeds off transformation energy. Rewards evolution-heavy decks with Burn resources. Pairs with Carpenter chain, Bigsby→Doom, any future transform cards."},
  // === SKYLAR SEED — PLAGUE/DECAY MECHANIC (2026-04-11) — GALLERY ONLY, NO BATTLE LOGIC ===
  // First ghost to target the opposing sideline. Working name, working numbers — pending 20-ghost name review.
  // === VOLCANIC ISLES — Designed Cards ===
  {id:317, name:"Scorch", art:"../testroom/art/scorch.webp", rarity:"common", maxHp:3, ability:"Singe", abilityDesc:"Win: opponent's active ghost loses 1 max HP permanently.", category:"Debuff", set:"Volcanic Isles", designNote:"Permanent max HP reduction. Shrinks opponent over time."},
  {id:319, name:"Pumice", art:"../testroom/art/pumice.webp", rarity:"common", maxHp:4, ability:"Float", abilityDesc:"Sideline: if your ghost would take 3+ damage, reduce to 2.", category:"Defense/Negation", set:"Volcanic Isles", designNote:"Damage cap from sideline."},
  {id:321, name:"Forge Fire", rarity:"uncommon", maxHp:5, art:"../testroom/art/forge_fire.webp", ability:"Temper", abilityDesc:"Spend 1 Surge: your next win deals double damage.", category:"Damage Multiplier", set:"Volcanic Isles", designNote:"Surge as offensive fuel."},
  {id:323, name:"Char", rarity:"common", maxHp:4, art:"../testroom/art/char.webp", ability:"Afterburn", abilityDesc:"Win: deal 1 damage at the start of next round.", category:"Debuff", set:"Volcanic Isles", designNote:"Delayed damage."},
  {id:325, name:"Magma Heart", rarity:"rare", maxHp:7, art:"../testroom/art/magma_heart.webp", ability:"Core Melt", abilityDesc:"Below 3 HP: all your damage ignores damage reduction effects.", category:"Damage Multiplier", set:"Volcanic Isles", designNote:"Eruption trigger — true damage when near death."},
  {id:327, name:"Natalia", rarity:"ghost-rare", maxHp:6, art:"../testroom/art/geode.jpg", ability:"Materialization", abilityDesc:"Even Doubles (2s, 4s, or 6s): gain 1 Moonstone.", category:"Resource Generation", set:"Volcanic Isles", designNote:"Even doubles reward. 2s, 4s, and 6s each trigger a Moonstone — covers weak and strong doubles alike."},
  {id:329, name:"Clink", rarity:"common", maxHp:3, art:"../testroom/art/clink.webp", ability:"Prospect", abilityDesc:"Win: gain 1 Surge. Lose: gain 1 Surge.", category:"Resource Generation", set:"Volcanic Isles", designNote:"Always generates something."},
  {id:331, name:"Igneous", rarity:"uncommon", maxHp:5, art:"../testroom/art/igneous.webp", ability:"Crystallize", abilityDesc:"Each round you don't take damage: gain 1 Surge.", category:"Resource Generation", set:"Volcanic Isles", designNote:"Rewards defense."},
  {id:333, name:"Smoke Signal", rarity:"common", maxHp:4, art:"../testroom/art/smoke_signal.webp", ability:"Warning", abilityDesc:"Sideline: reveal opponent's sideline abilities.", category:"Prediction/Reaction", set:"Volcanic Isles", designNote:"Information card. Passive recon."},
  {id:335, name:"Soot Sprite", rarity:"rare", maxHp:6, art:"../testroom/art/soot_sprite.webp", ability:"Scatter", abilityDesc:"When hit: split into 2 copies with half HP each. Opponent must KO both.", category:"Defense/Negation", set:"Volcanic Isles", designNote:"Splitting is completely new."},
  {id:337, name:"Fuego", rarity:"uncommon", maxHp:5, art:"../testroom/art/fuego.webp", ability:"Fiesta", abilityDesc:"Win with triples: gain 1 of every resource.", category:"Resource Generation", set:"Volcanic Isles", designNote:"The jackpot card. Rare but massive payoff."},
  {id:339, name:"Slag Heap", art:"../testroom/art/slag_heap.webp", rarity:"common", maxHp:3, ability:"Residue", abilityDesc:"When defeated: opponent's active ghost cannot heal for 2 rounds.", category:"Debuff", set:"Volcanic Isles", designNote:"Anti-healing death trigger."},
  {id:341, name:"Obsidian Throne", rarity:"ghost-rare", maxHp:7, art:"../testroom/art/obsidian_throne.webp", ability:"Dominion", abilityDesc:"While active: opponent cannot use items (Surge, Surge, Healing Seeds).", category:"Debuff", set:"Volcanic Isles", designNote:"Item lockdown. Opponent hoards but can't spend."},
  {id:343, name:"Boris", rarity:"common", maxHp:6, art:"../testroom/art/bastion.webp", ability:"Fortify", abilityDesc:"When you spend a Surge: Boris gains 2 HP (can exceed max HP).", category:"Defense/Negation", set:"Volcanic Isles", designNote:"Surge for tankiness. Overclocks past maxHp like Calvin — all heals overclock except Healing Seeds."},
  {id:345, name:"Red Hunter", art:"../testroom/art/tremor.webp", rarity:"ghost-rare", maxHp:6, ability:"Rumble", abilityDesc:"Win: if your opponent has any specials, deal +3 damage.", category:"Damage Multiplier", set:"Volcanic Isles", designNote:"Punishes hoarders. Logic was already correct — only fires on a winning roll. Text now matches behavior."},
  {id:347, name:"Eruption", rarity:"rare", maxHp:7, art:"../testroom/art/eruption.webp", ability:"Blow", abilityDesc:"Spend 2 Silver Leaves: deal 4 damage immediately. No roll needed.", category:"Destruction/Instant Kill", set:"Volcanic Isles", designNote:"Direct damage. Guaranteed 4 for 2 Silver Leaves."},
  {id:349, name:"Wick", rarity:"uncommon", maxHp:5, art:"../testroom/art/wick.webp", ability:"Slow Burn", abilityDesc:"Each round: deal 1 damage to opponent. But lose 1 HP yourself.", category:"Debuff", set:"Volcanic Isles", designNote:"Mutual destruction timer."},
  {id:351, name:"Glow Worm", rarity:"common", maxHp:5, art:"../testroom/art/glow_worm.webp", ability:"Tunnel", abilityDesc:"Spend 1 Surge: switch your active ghost. Free action, no swap triggers.", category:"Prediction/Reaction", set:"Volcanic Isles", designNote:"Resource-powered free swap."},
  {id:353, name:"Molten Mirror", rarity:"rare", maxHp:6, art:"../testroom/art/molten_mirror.webp", ability:"Reflect Pool", abilityDesc:"Opponent's resource-spending abilities also cost 1 additional resource.", category:"Debuff", set:"Volcanic Isles", designNote:"Resource tax. Economy warfare."},
  {id:355, name:"Puff Ball", rarity:"common", maxHp:3, art:"../testroom/art/puff_ball.webp", ability:"Burst", abilityDesc:"When hit by doubles: explode for 2 damage to opponent. Then KO yourself.", category:"Destruction/Instant Kill", set:"Volcanic Isles", designNote:"Reactive suicide bomber. 41.7% trigger rate."},
  {id:357, name:"Anvil", rarity:"uncommon", maxHp:6, art:"../testroom/art/anvil.webp", ability:"Heavy Strike", abilityDesc:"Spend 1 Surge: singles deal 3 damage instead of 1 this round.", category:"Damage Multiplier", set:"Volcanic Isles", designNote:"Surge turns weak singles devastating."},
  {id:359, name:"Volcanic Heart", art:"../testroom/art/volcanic_heart.webp", rarity:"ghost-rare", maxHp:8, ability:"Pulse", abilityDesc:"Every 3 rounds: deal 2 damage to ALL ghosts on the field (both teams).", category:"Damage Multiplier", set:"Volcanic Isles", designNote:"Board-wide pulse. Changes team building."},
  {id:361, name:"Ash Phoenix", art:"../testroom/art/ash_phoenix.webp", rarity:"rare", maxHp:4, ability:"Rebirth", abilityDesc:"When defeated: return to battle next round with 2 HP. Once Per Game.", category:"HP Recovery", set:"Volcanic Isles", designNote:"Self-resurrection."},
  {id:363, name:"Pyrope", rarity:"uncommon", maxHp:5, art:"../testroom/art/pyrope.webp", ability:"Gem Armor", abilityDesc:"Spend 1 Surge: negate the next instance of damage.", category:"Defense/Negation", set:"Volcanic Isles", designNote:"Surge as a shield."},
  {id:365, name:"Tyson", rarity:"common", maxHp:4, art:"../testroom/art/cinder_bunny.png", ability:"Hop", abilityDesc:"Win: choose an enemy sideline Spiritkin. That Spiritkin's sideline ability is disabled until it enters play.", category:"Disruption", set:"Volcanic Isles", designNote:"Targeted sideline disabler. Stacks across wins. Persists after Tyson dies."},
  {id:367, name:"Dragonclaw", rarity:"rare", maxHp:7, art:"../testroom/art/dragonclaw.webp", ability:"Rake", abilityDesc:"Win with 3 different numbers: deal +3 damage.", category:"Damage Multiplier", set:"Volcanic Isles", designNote:"Rewards diverse rolls. ~55% trigger rate."},
  // === EJ'S GHOSTS ===
  {id:401, name:"Knight Terror", rarity:"rare", maxHp:6, art:"../testroom/art/knight_terror.webp",
    ability:"Heavy Air", abilityDesc:"While active: after the opponent's active Spiritkin's ability triggers, it loses 2 HP.",
    category:"Debuff", set:"Dark Castle",
    designNote:"EJ's dark knight. Suppression tank — the opponent's whole team bleeds just for playing the game. Abilities still work, but at a cost."},
  {id:402, name:"Knight Light", rarity:"uncommon", maxHp:6, art:"../testroom/art/knight_light.png",
    ability:"Retribution", abilityDesc:"While active: when an opponent's ability triggers, gain 1 extra die next roll.",
    category:"Dice Modifier", set:"Dark Castle",
    designNote:"EJ's light knight. Opposing pair with Knight Terror — opponent abilities give you extra dice. Punishes ability-heavy teams."},
  {id:403, name:"Smudge", rarity:"rare", maxHp:5, art:"../testroom/art/smudge.webp",
    ability:"Blackout", abilityDesc:"Before rolling: name a number. If your opponent rolls it, that die doesn't count.",
    category:"Dice Modifier", set:"Volcanic Isles",
    designNote:"EJ's paint-fire spirit. Splatters a number off the dice. ~42% chance to kill at least one die. Prediction meets disruption."},
  {id:404, name:"Chagrin", rarity:"uncommon", maxHp:6, art:"../testroom/art/chagrin.png",
    ability:"Bitter End", abilityDesc:"Lose: gain 1 Surge.",
    category:"Resource Generation", set:"Volcanic Isles",
    designNote:"EJ's spite ghost. Turns frustration into fuel — every loss powers you up. 6 HP tank that's happy to eat hits."},
  {id:406, name:"Fed and Hayden", rarity:"common", maxHp:4, art:"../testroom/art/fed_and_hayden.png",
    ability:"Eternal Flame", abilityDesc:"Sacred Fires are not discarded when used.",
    category:"Resource Generation", set:"Volcanic Isles",
    designNote:"EJ's lava lion duo. Sacred Fire economy card — your flames never go out. Fragile at 4 HP, protect them."},

  // ============================================================
  // ORIGINAL SET 1
  // ============================================================
  {id:1, name:"Kodako", rarity:"common", maxHp:6, art:"../testroom/art/originals/kodako.jpg", ability:"Swift", abilityDesc:"Roll 1-2-3: negate damage and deal 4 to enemy.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Sequence combo defender."},
  {id:2, name:"Nikon", rarity:"common", maxHp:6, art:"../testroom/art/originals/nikon.jpg", ability:"Ambush", abilityDesc:"Win first roll: deal triple damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. First-strike specialist."},
  {id:3, name:"Ancient Librarian", rarity:"common", maxHp:6, art:"../testroom/art/originals/AncientLibrarian.png", ability:"Knowledge", abilityDesc:"For each 2 rolled by both players, add +1 damage if you deal damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. 2s matter."},
  {id:4, name:"Wanderer", rarity:"common", maxHp:8, art:"../testroom/art/originals/Wanderer.png", ability:"Curiosity", abilityDesc:"Roll a straight (consecutive sequence, no repeats): deal +2 damage.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. Reworked — straight bonus damage."},
  {id:5, name:"Puff", rarity:"common", maxHp:6, art:"../testroom/art/originals/Puff.png", ability:"Cute", abilityDesc:"Enemy Doubles and Triples do -1 damage.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Soft tank."},
  {id:6, name:"Fang Outside", rarity:"common", maxHp:2, art:"../testroom/art/originals/FangOutside.png", ability:"Skillful Coward", abilityDesc:"Win: you may switch with a Spiritkin on your sideline after damage.", category:"Prediction/Reaction", set:"Set 1", designNote:"Original card. Hit-and-run."},
  {id:7, name:"Fang Undercover", rarity:"common", maxHp:2, art:"../testroom/art/originals/FangUndercover.png", ability:"Skilled Coward", abilityDesc:"When taking damage, you may switch Fang Undercover with any sideline Spiritkin and negate damage.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Damage dodge."},
  {id:8, name:"Buttons", rarity:"common", maxHp:1, art:"../testroom/art/originals/Buttons.png", ability:"Perfect Plan", abilityDesc:"If Buttons rolls triple 6's, deal +15 damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. The dream."},
  {id:9, name:"Little Boo", rarity:"common", maxHp:2, art:"../testroom/art/originals/LittleBoo.png", ability:"Mercy", abilityDesc:"Enemy Triples count as a 1-2-3 roll instead.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Triple negator."},
  {id:10, name:"Patrick", rarity:"common", maxHp:3, art:"../testroom/art/originals/patrick.jpg", ability:"Stone Form", abilityDesc:"Don't roll. If opponent rolls Singles: negate damage, deal 3.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. The statue."},
  {id:11, name:"Villager", rarity:"common", maxHp:4, art:"../testroom/art/originals/Villager.png", ability:"Hospitality", abilityDesc:"Sideline: your active Spiritkin gains 1 HP on wins.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Sideline healer."},
  {id:12, name:"Dupy", rarity:"common", maxHp:4, art:"../testroom/art/originals/Dupy.png", ability:"Frolic", abilityDesc:"Tie: instantly KO the enemy Spiritkin.", category:"Destruction/Instant Kill", set:"Set 1", designNote:"Original card. Tie = death."},
  {id:13, name:"Shoo", rarity:"common", maxHp:4, art:"../testroom/art/originals/Shoo.png", ability:"Alpine Air", abilityDesc:"Sideline: your active Spiritkin gains 2 HP when below 4 HP. Once Per Spiritkin.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Emergency heal."},
  {id:14, name:"Jeffery", rarity:"common", maxHp:5, art:"../testroom/art/originals/Jeffery.png", ability:"Chuckle", abilityDesc:"Sideline: when your active Spiritkin defeats an enemy, it gains 3 HP.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Win-triggered sideline healer."},
  {id:15, name:"Winston", rarity:"common", maxHp:5, art:"../testroom/art/originals/Winston.png", ability:"Scheme", abilityDesc:"Win: you may swap the enemy active Spiritkin with one from their sideline. Gain +2 dice next roll.", category:"Prediction/Reaction", set:"Set 1", designNote:"Original card. Forced swap on win + bonus dice."},
  {id:16, name:"Chip", rarity:"common", maxHp:4, art:"../testroom/art/originals/Chip.png", ability:"Acrobatic Dive", abilityDesc:"Even Doubles: +3 damage if you deal damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Even doubles specialist."},
  {id:17, name:"Boo Brothers", rarity:"common", maxHp:5, art:"../testroom/art/originals/boo_brothers.jpg", ability:"Teamwork", abilityDesc:"Before rolling: you may remove 1 die to gain 1 HP. If you do, deal +1 damage this roll.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Die-for-HP trade + damage bonus."},
  {id:18, name:"Charlie", rarity:"common", maxHp:4, art:"../testroom/art/originals/Charlie.png", ability:"Rush", abilityDesc:"Upon losing a roll, you may Flick one of your dice. Any die hit changes its result on contact.", category:"Prediction/Reaction", set:"Set 1", designNote:"Original card. Flick mechanic — fling your lowest die into the others to change results."},
  {id:34, name:"Grawr", rarity:"uncommon", maxHp:7, art:"../testroom/art/originals/Grawr.png", ability:"Menace", abilityDesc:"Entry: deal 1 damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Entry damage."},
  {id:35, name:"Larry", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/Larry.png", ability:"Flying Kick", abilityDesc:"Triples deal 3X damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Triples monster."},
  {id:36, name:"Bill & Bob", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/Bill&Bob.png", ability:"Bait n Switch", abilityDesc:"Below 4 HP: wins deal 2X damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Low HP berserker."},
  {id:37, name:"Dealer", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Dealer.png", ability:"House Rules", abilityDesc:"Roll a straight: +3 damage and negate all incoming damage.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Reworked — straight = offense + defense."},
  {id:38, name:"Alucard", rarity:"uncommon", maxHp:4, art:"../testroom/art/originals/Alucard.png", ability:"Colony Call", abilityDesc:"Doubles deal +2 damage for each Spiritkin on your sideline. Once Per Game.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Sideline-scaling nuke."},
  {id:39, name:"Castle Guards", rarity:"uncommon", maxHp:7, art:"../testroom/art/originals/CastleGuards.png", ability:"Flamethrower", abilityDesc:"Each 3 you roll doubles Castle Guards' damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. 3s matter."},
  {id:40, name:"Team Zippy", rarity:"uncommon", maxHp:7, art:"../testroom/art/originals/TeamZippy.png", ability:"Teamwork", abilityDesc:"Win with Singles: deal +2 damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Singles booster."},
  {id:41, name:"Guard Thomas", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/guard_thomas.jpg", ability:"Stoic", abilityDesc:"Below 6 HP: immune to Singles damage.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Singles immunity tank."},
  {id:42, name:"Doc", rarity:"uncommon", maxHp:2, art:"../testroom/art/originals/Doc.png", ability:"Savage", abilityDesc:"+5 damage on Doubles.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Glass cannon."},
  {id:43, name:"Outlaw", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/outlaw.jpg", ability:"Thief", abilityDesc:"Doubles: remove 1 enemy die next roll.", category:"Debuff", set:"Set 1", designNote:"Original card. Die stealer."},
  {id:44, name:"Bubble Boys", rarity:"uncommon", maxHp:9, art:"../testroom/art/originals/bubble_boys.jpg", ability:"Pop", abilityDesc:"If the enemy rolls Triples, Bubble Boys are defeated.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. 9 HP but triples = insta-death."},
  {id:45, name:"Cornelius", rarity:"uncommon", maxHp:2, art:"../testroom/art/originals/Cornelius.png", ability:"Antidote", abilityDesc:"Sideline: negate all enemy sideline effects.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Sideline silencer."},
  {id:46, name:"Cave Dweller", rarity:"uncommon", maxHp:7, art:"../testroom/art/originals/cave_dweller.jpg", ability:"Lurk", abilityDesc:"Deal 3X damage on first roll win.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Like Nikon but stronger."},
  {id:47, name:"Hermit", rarity:"uncommon", maxHp:3, art:"../testroom/art/originals/Hermit.png", ability:"Solitude", abilityDesc:"Entry: gain 2 HP for each Spiritkin defeated on both teams.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Late-game scaling tank."},
  {id:48, name:"Opa", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Opa.png", ability:"Rest", abilityDesc:"Win or tie: gain 1 HP.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Win/tie healer."},
  {id:49, name:"Greg", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Greg.png", ability:"Chase", abilityDesc:"While Greg has more HP than the enemy Spiritkin: deal 2X damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. HP-advantage doubler."},
  {id:50, name:"Jackson", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/Jackson.png", ability:"Regrow", abilityDesc:"After your roll, you may spend 1 of Jackson's HP to reroll 1 die.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. HP-for-reroll. 6 HP (was 3) — more HP = more rerolls."},
  {id:62, name:"Raditz", rarity:"rare", maxHp:6, art:"../testroom/art/originals/Raditz.png", ability:"Hunt", abilityDesc:"Entry: you may swap the enemy active Spiritkin with one from their sideline.", category:"Prediction/Reaction", set:"Set 1", designNote:"Original card. Entry forced swap."},
  {id:63, name:"Doug", rarity:"rare", maxHp:3, art:"../testroom/art/originals/Doug.png", ability:"Caution", abilityDesc:"Before rolling: Doug may switch with a sideline Spiritkin Once Per Game. Gain 1 extra die next roll.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. Safe swap + bonus die."},
  {id:64, name:"Sparky", rarity:"rare", maxHp:4, art:"../testroom/art/originals/Sparky.png", ability:"Tinder", abilityDesc:"Your rolled 1's add +3 damage each if you deal damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. 1s become weapons."},
  {id:65, name:"Wim", rarity:"rare", maxHp:6, art:"../testroom/art/originals/wim.jpg", ability:"Slash", abilityDesc:"+5 damage when all dice are odd.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. All-odd bonus."},
  {id:66, name:"Munch", rarity:"rare", maxHp:6, art:"../testroom/art/originals/Munch.png", ability:"Scraps", abilityDesc:"Defeat a Spiritkin: gain 4 HP.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Kill-to-heal."},
  {id:67, name:"Snorton", rarity:"rare", maxHp:8, art:"../testroom/art/originals/snorton.jpg", ability:"Fissure", abilityDesc:"+5 damage if you roll at least two 6's and deal damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Double 6s nuke."},
  {id:68, name:"Kairan", rarity:"rare", maxHp:4, art:"../testroom/art/originals/kairan.jpg", ability:"Let's Dance", abilityDesc:"Doubles: +1 die next roll.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. Doubles = dice growth."},
  {id:69, name:"Sonya", rarity:"rare", maxHp:3, art:"../testroom/art/originals/Sonya.png", ability:"Mesmerize", abilityDesc:"Each roll: you may change 1 die result to a 2.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. Guaranteed 2 manipulation."},
  {id:70, name:"Katrina", rarity:"rare", maxHp:5, art:"../testroom/art/originals/katrina.jpg", ability:"Seeker", abilityDesc:"Before rolling: if you have less HP than the enemy, gain 1 HP.", category:"HP Recovery", set:"Set 1", designNote:"Original card. Underdog healer."},
  {id:71, name:"Admiral", rarity:"rare", maxHp:3, art:"../testroom/art/originals/Admiral.png", ability:"Comrades", abilityDesc:"Sideline: +2 damage on even Doubles.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Sideline doubles booster."},
  {id:72, name:"Sky", rarity:"rare", maxHp:4, art:"../testroom/art/originals/Sky.png", ability:"Elusive", abilityDesc:"If incoming damage is greater than 2: negate it. Sky rolls 1 die and deals its value as damage.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Big damage immunity + counter. Reworked: now deals counter damage via interactive single-die roll (like Jasper/Balatron)."},
  {id:73, name:"Stone Cold", rarity:"rare", maxHp:7, art:"../testroom/art/originals/stone_cold.jpg", ability:"One-two-one!", abilityDesc:"Roll double 1's: deal 3X damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Double 1s finisher."},
  {id:74, name:"Dark Jeff", rarity:"rare", maxHp:3, art:"../testroom/art/originals/DarkJeff.png", ability:"Cackle", abilityDesc:"Sideline: +1 damage to all your rolls.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Passive sideline damage."},
  {id:75, name:"Flora", rarity:"rare", maxHp:4, art:"../testroom/art/originals/flora.jpg", ability:"Restore", abilityDesc:"Doubles: gain 2 HP after damage is applied.", category:"HP Recovery", set:"Set 1", designNote:"Original card. The very first card Wyatt made as a kid."},
  {id:76, name:"Dark Wing", rarity:"rare", maxHp:2, art:"../testroom/art/originals/DarkWing.png", ability:"Precision", abilityDesc:"Once Per Game: if Dark Wing rolls Singles, reroll all dice.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. One-shot precision reroll — only offered on singles (doubles or better is already fine)."},
  {id:77, name:"City Cyboo", rarity:"rare", maxHp:1, art:"../testroom/art/originals/CityCyboo.png", ability:"Aftershock", abilityDesc:"In Play: after rolling, roll 1 bonus die. Any enemy dice showing that number are removed.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. Post-roll Blackout — rolls a bonus die that erases matching enemy dice. 1 HP glass cannon disruptor."},
  {id:94, name:"Jenkins", rarity:"ghost-rare", maxHp:5, art:"../testroom/art/originals/Jenkins.png", ability:"Greeting", abilityDesc:"Entry: roll 4 dice and deal damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Entry nuke."},
  {id:95, name:"Tabitha", rarity:"ghost-rare", maxHp:1, art:"../testroom/art/originals/Tabitha.png", ability:"Rally", abilityDesc:"Sideline: +2 damage on Doubles.", category:"Damage Multiplier", set:"Set 1", designNote:"Original card. Sideline doubles buff."},
  {id:99, name:"Guardian Fairy", rarity:"ghost-rare", maxHp:3, art:"../testroom/art/originals/GuardianFairy.png", ability:"Wish", abilityDesc:"Sideline: when your active Spiritkin is about to take damage, Guardian Fairy leaps in and takes the hit instead.", category:"Defense/Negation", set:"Set 1", designNote:"Original card. Sacrifice bodyguard."},
  {id:100, name:"Cyboo", rarity:"ghost-rare", maxHp:3, art:"../testroom/art/originals/Cyboo.png", ability:"Spark", abilityDesc:"Sideline: your active Spiritkin gains 1 extra die when below 3 HP.", category:"Dice Modifier", set:"Set 1", designNote:"Original card. Low HP dice boost."},
  {id:101, name:"Splinter", rarity:"ghost-rare", maxHp:4, art:"../testroom/art/originals/Splinter.png", ability:"Toxic Fumes", abilityDesc:"Win once to activate Toxic Fumes permanently. While active: deal 1 damage to the enemy before each roll.", category:"Debuff", set:"Set 1", designNote:"Original card. Stacking poison."},
  {id:109, name:"Bo", rarity:"legendary", maxHp:5, art:"../testroom/art/originals/Bo.png", ability:"Miracle", abilityDesc:"Defeat a Spiritkin: return one of your defeated Spiritkin to your sideline. Gain 1 Magic Firefly.", category:"HP Recovery", set:"Set 1", designNote:"Original legendary. Resurrection on kill."},
  {id:110, name:"The Mountain King", rarity:"legendary", maxHp:9, art:"../testroom/art/originals/mountain_king_leg.jpg", ability:"Beast Mode", abilityDesc:"Doubles deal 2X damage.", category:"Damage Multiplier", set:"Set 1", designNote:"Original legendary. Doubles doubler."},
  {id:111, name:"Shade", rarity:"legendary", maxHp:5, art:"../testroom/art/originals/shade.jpg", ability:"Haunt", abilityDesc:"Before each roll, opponent takes 1 damage.", category:"Debuff", set:"Set 1", designNote:"Original legendary. Tick damage every round, including round 1."},
  {id:112, name:"Doom", rarity:"legendary", maxHp:7, art:"../testroom/art/originals/doom.jpg", ability:"Fiendship", abilityDesc:"+2 bonus damage!", category:"Damage Multiplier", set:"Set 1", designNote:"Original legendary. Raw power."},

  // ============================================================
  // DARK CASTLE
  // ============================================================
  {id:19, name:"Scallywags", rarity:"common", maxHp:5, art:"../testroom/art/originals/Scallywags.png", ability:"Frenzy", abilityDesc:"If all your dice are under 4: gain 1 extra die and 1 Surge next roll.", category:"Dice Modifier", set:"Dark Castle", designNote:"Dark Castle. Low-roll reward."},
  {id:20, name:"Floop", rarity:"common", maxHp:5, art:"../testroom/art/originals/Floop.png", ability:"Muck", abilityDesc:"If the enemy rolls Doubles: they lose 1 die next roll.", category:"Debuff", set:"Dark Castle", designNote:"Dark Castle. Anti-doubles punisher. 5 HP (was 4)."},
  {id:21, name:"Needle", rarity:"common", maxHp:7, art:"../testroom/art/originals/Needle_dc.png", ability:"Big Bro", abilityDesc:"Sideline: if Buttons is In Play, gain 1 extra die.", category:"Dice Modifier", set:"Dark Castle", designNote:"Dark Castle. Buttons synergy."},
  {id:22, name:"Ancient One", rarity:"common", maxHp:7, art:"../testroom/art/originals/ancient_one.jpg", ability:"Friend to All", abilityDesc:"Sideline: your active Spiritkin gains 3 HP on ties.", category:"HP Recovery", set:"Dark Castle", designNote:"Dark Castle. Tie healer."},
  {id:51, name:"Nicholas", rarity:"uncommon", maxHp:1, art:"../testroom/art/originals/nicholas.jpg", ability:"Sneak Attack", abilityDesc:"Sideline: deal 2 damage to the enemy Spiritkin when they enter play.", category:"Damage Multiplier", set:"Dark Castle", designNote:"Dark Castle. Entry punisher."},
  {id:52, name:"Hugo", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/Hugo.png", ability:"Wreckage", abilityDesc:"When Hugo takes damage: the opponent loses 1 die next roll.", category:"Debuff", set:"Dark Castle", designNote:"Dark Castle. Damage retaliation."},
  {id:78, name:"Haywire", rarity:"rare", maxHp:7, art:"../testroom/art/originals/Haywire.png", ability:"Wild Chords", abilityDesc:"Triples or better: gain 1 permanent die. Haywire gains +2 permanent damage. Once Per Game.", category:"Dice Modifier", set:"Dark Castle", tags:["Final 50"], designNote:"Dark Castle. Main character — dice growth + personal damage snowball. Two subjects: the die belongs to the player's pool, the +2 damage is Haywire's personal buff."},
  {id:79, name:"Laura", rarity:"rare", maxHp:4, art:"../testroom/art/originals/laura.jpg", ability:"Catchy Tune", abilityDesc:"Sideline & In Play: Roll a straight to gain +1 permanent die and lock one die after each roll for the next roll. Stacks.", category:"Dice Modifier", set:"Rolling Hills", designNote:"Rolling Hills. Straight unlocks permanent die-lock. Player chooses which die to carry over."},
  {id:80, name:"Bilbo", rarity:"rare", maxHp:2, art:"../testroom/art/originals/bilbo.jpg", ability:"Little Buddy", abilityDesc:"Sideline: your active Spiritkin deals +2 damage on Singles.", category:"Damage Multiplier", set:"Dark Castle", designNote:"Dark Castle. Sideline singles booster."},
  {id:96, name:"Hector", rarity:"ghost-rare", maxHp:6, art:"../testroom/art/originals/hector.jpg", ability:"Protector", abilityDesc:"Singles beat Doubles. +1 damage on Singles.", category:"Defense/Negation", set:"Dark Castle", designNote:"Dark Castle ghost-rare. Flips the hierarchy."},
  {id:97, name:"Toby", rarity:"ghost-rare", maxHp:7, art:"../testroom/art/originals/Toby.png", ability:"Pure Heart", abilityDesc:"Before rolling: you may declare the final roll. Toby is defeated next roll. Win: defeat the enemy Spiritkin.", category:"Destruction/Instant Kill", set:"Dark Castle", designNote:"Dark Castle ghost-rare. All-in gamble."},
  {id:98, name:"Redd", rarity:"ghost-rare", maxHp:7, art:"../testroom/art/originals/Redd.png", ability:"Notorious", abilityDesc:"Entry: gain 2 extra dice this roll.", category:"Dice Modifier", set:"Dark Castle", designNote:"Dark Castle ghost-rare. Entry dice burst."},
  {id:108, name:"Lucy", rarity:"legendary", maxHp:8, art:"../testroom/art/originals/lucy.jpg", ability:"Blue Fire", abilityDesc:"Win: gain 1 Sacred Fire.", category:"Resource Generation", set:"Dark Castle", designNote:"Dark Castle legendary. REWORKED 2026-04-12: swapped to Sacred Fire gen (was delayed chip + Burn). Simple, elegant — Lucy's blue flame IS Sacred Fire. 8 HP legendary tank that fuels the fire economy."},

  // ============================================================
  // FROST VALLEY
  // ============================================================
  {id:23, name:"Powder", rarity:"common", maxHp:5, art:"../testroom/art/originals/powder.jpg", ability:"Blizzard", abilityDesc:"Discard 1 Ice Shard: place 2 Frostbite on each enemy sideline ghost.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Ice Shard → Frostbite converter. Blankets the enemy bench."},
  {id:24, name:"Simon", rarity:"common", maxHp:4, art:"../testroom/art/originals/simon.jpg", ability:"Brew Time", abilityDesc:"Sideline: before rolling, you may discard 3 Specials to gain 1 Moonstone.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Sideline moonstone converter. Trade 3 specials for 1 Moonstone pre-roll."},
  {id:25, name:"Cameron", rarity:"common", maxHp:6, art:"../testroom/art/originals/cameron.jpg", ability:"Winter's Harvest", abilityDesc:"Roll Doubles: gain 1 Frostbite and 1 Ice Shard.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Doubles-based Frostbite + Ice Shard generator. Fuels Powder and Calvin & Anna."},
  {id:26, name:"Logey", rarity:"common", maxHp:4, art:"../testroom/art/originals/logey.jpg", ability:"Heinous", abilityDesc:"Opponent's 5+ dice are unavailable next roll.", category:"Debuff", set:"Frost Valley", designNote:"Frost Valley. High-die lockout."},
  {id:27, name:"Fredrick", rarity:"common", maxHp:5, art:"../testroom/art/originals/fredrick.jpg", ability:"Unstoppable Force", abilityDesc:"If the opponent uses a special, Fredrick gains 1 extra die. Fredrick's damage cannot be negated.", category:"Dice Boost/Anti-Negation", set:"Frost Valley", designNote:"Frost Valley. Punishes special usage with bonus dice. Damage pierces all negation."},
  {id:28, name:"Dream Cat", rarity:"common", maxHp:4, art:"../testroom/art/originals/dream_cat.jpg", ability:"Jinx", abilityDesc:"Both roll Doubles: gain 2 extra dice next roll.", category:"Dice Modifier", set:"Frost Valley", designNote:"Frost Valley. Mutual doubles reward. Buffed: +2 dice (was +1)."},
  {id:29, name:"Sad Sal", rarity:"common", maxHp:5, art:"../testroom/art/originals/sad_sal.jpg", ability:"Tough Job", abilityDesc:"Lose: gain 1 Ice Shard.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Loss-triggered resources."},
  {id:30, name:"Tommy Salami", rarity:"common", maxHp:6, art:"../testroom/art/originals/tommy_salami_new.png", ability:"Regulator", abilityDesc:"When you roll a 6: gain 1 extra die and roll it immediately. Repeats as long as you keep rolling 6s.", category:"Dice Modifier", set:"Frost Valley", tags:["Final 50"], designNote:"Frost Valley. Chain-6s bonus dice."},
  {id:31, name:"Gus", rarity:"common", maxHp:6, art:"../testroom/art/originals/gus.jpg", ability:"Gale Force", abilityDesc:"Win: you may force the opponent to swap their active Spiritkin. The new Spiritkin takes the damage.", category:"Disruption", set:"Frost Valley", designNote:"Frost Valley. Win → force swap, new ghost eats the damage."},
  {id:32, name:"Lou", rarity:"common", maxHp:7, art:"../testroom/art/originals/lou.jpg", ability:"Bros", abilityDesc:"Sideline: Grawr gains +1 damage and 1 HP on wins.", category:"Damage Multiplier", set:"Frost Valley", designNote:"Frost Valley. Grawr synergy."},
  {id:33, name:"Sandwiches", rarity:"common", maxHp:6, art:"../testroom/art/originals/sandwiches.jpg", ability:"Dependable", abilityDesc:"Sideline & In Play: if your opponent gains a Special, you gain it as well.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Resource mirror."},
  {id:53, name:"Bogey", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/bogey.jpg", ability:"Bogus", abilityDesc:"When damage would hit Bogey, you may reflect it back at the attacker. Once Per Game.", category:"Defense/Negation", set:"Frost Valley", designNote:"Frost Valley. One-shot reactive reflect."},
  {id:54, name:"Roger", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/roger.jpg", ability:"Tempest", abilityDesc:"Roll 2 pairs of Doubles (4+ dice): gain 3 Sacred Fires.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Double-pair jackpot."},
  {id:55, name:"Masked Hero", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/masked_hero.jpg", ability:"Underdog", abilityDesc:"Immune to before-roll damage. Gain 1 Burn for each 3 you roll.", category:"Defense/Negation", set:"Frost Valley", designNote:"Frost Valley. Pre-roll immunity + Burn generation on 3s."},
  {id:56, name:"Chad", rarity:"common", maxHp:6, art:"../testroom/art/originals/chad.jpg", ability:"Sploop!", abilityDesc:"Entry: gain 2 Ice Shards.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Entry resource gen."},
  {id:57, name:"Marcus", rarity:"uncommon", maxHp:7, art:"../testroom/art/originals/marcus.jpg", ability:"Glacial Pounding", abilityDesc:"Take 3+ damage: gain 4 extra dice next roll.", category:"Dice Modifier", set:"Frost Valley", designNote:"Frost Valley. Big hit = big retaliation. Bonus goes to player (next active ghost), not just Marcus."},
  {id:58, name:"Ashley", rarity:"uncommon", maxHp:3, art:"../testroom/art/originals/ashley.jpg", ability:"Burning Soul", abilityDesc:"Win: gain 1 Sacred Fire.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Win-triggered Sacred Fire."},
  {id:59, name:"Mr Filbert", rarity:"common", maxHp:6, art:"../testroom/art/originals/mr_filbert.jpg", ability:"Mask Merchant", abilityDesc:"Sideline: any healing instead deals damage to the intended Spiritkin.", category:"Debuff", set:"Frost Valley", designNote:"Frost Valley. Anti-healing."},
  {id:60, name:"Dallas", rarity:"uncommon", maxHp:4, art:"../testroom/art/originals/dallas.jpg", ability:"Quick Draw", abilityDesc:"Entry: steal 1 enemy die for the first 2 rolls.", category:"Dice Modifier", set:"Frost Valley", designNote:"Frost Valley. Entry die theft."},
  {id:61, name:"Suspicious Jeff", rarity:"uncommon", maxHp:4, art:"../testroom/art/originals/suspicious_jeff.jpg", ability:"Snicker", abilityDesc:"Sideline: on wins, steal 1 enemy die next roll.", category:"Debuff", set:"Frost Valley", designNote:"Frost Valley. Sideline die theft."},
  {id:81, name:"Spockles", rarity:"rare", maxHp:6, art:"../testroom/art/originals/spockles.jpg", ability:"Valley Magic", abilityDesc:"Win: gain 2 Ice Shards.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Ice Shard farmer."},
  {id:82, name:"Antoinette", rarity:"uncommon", maxHp:6, art:"../testroom/art/originals/antoinette.jpg", ability:"Grace", abilityDesc:"Roll as many dice as your opponent. +1 damage on Doubles.", category:"Dice Modifier", set:"Frost Valley", designNote:"Frost Valley. Dice mirroring."},
  {id:83, name:"Troubling Haters", rarity:"uncommon", maxHp:3, art:"../testroom/art/originals/troubling_haters.jpg", ability:"Growing Mob", abilityDesc:"Deal 4+ damage: gain 2 HP.", category:"HP Recovery", set:"Frost Valley", designNote:"Frost Valley. Big damage = HP growth."},
  {id:84, name:"Wandering Sue", rarity:"uncommon", maxHp:4, art:"../testroom/art/originals/wandering_sue.jpg", ability:"Hidden Weakness", abilityDesc:"Before rolling: if the enemy has more HP than Sue, gain 1 extra die.", category:"Dice Modifier", set:"Frost Valley", designNote:"Frost Valley. Underdog dice bonus — almost always active at 4HP."},
  {id:85, name:"Eloise", rarity:"rare", maxHp:5, art:"../testroom/art/originals/eloise.jpg", ability:"Change of Heart", abilityDesc:"Spend 1 Ice Shard to swap HP with enemy before rolling.", category:"Prediction/Reaction", set:"Frost Valley", designNote:"Frost Valley. HP swap for Ice Shard."},
  {id:86, name:"Pelter", rarity:"rare", maxHp:5, art:"../testroom/art/originals/pelter.jpg", ability:"Snowball Fight", abilityDesc:"Sideline & In Play: gain 1 Frostbite for each 1 you roll.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Frostbite generator from 1s. Pairs with Gary for ice+frostbite from 1s."},
  {id:87, name:"Zach", rarity:"rare", maxHp:7, art:"../testroom/art/originals/zach.jpg", ability:"Craftsman", abilityDesc:"Sideline: Guard Thomas gains +2 damage on Doubles and +1 die each roll.", category:"Damage Multiplier", set:"Frost Valley", designNote:"Frost Valley. Guard Thomas synergy. Buffed: now also grants +1 die per turn."},
  {id:88, name:"Pale Nimbus", rarity:"rare", maxHp:4, art:"../testroom/art/originals/pale_nimbus.jpg", ability:"Hidden Storm", abilityDesc:"Sideline: +2 damage if your total dice add to less than 7.", category:"Damage Multiplier", set:"Frost Valley", designNote:"Frost Valley. Low-roll sideline booster."},
  {id:89, name:"Mallow", rarity:"rare", maxHp:5, art:"../testroom/art/originals/mallow.jpg", ability:"Dozy Cozy", abilityDesc:"Sideline: before rolling, you may spend 2 Sacred Fire to give your active Spiritkin 3 HP and gain 1 Burn.", category:"HP Recovery", set:"Frost Valley", designNote:"Frost Valley. Sacred Fire healing. Costs 2 fire to slow the Lucy loop. Grants 1 Burn as upside. 5 HP restored."},
  {id:90, name:"Jeanie", rarity:"rare", maxHp:4, art:"../testroom/art/originals/jeanie.jpg", ability:"Hidden Treasure", abilityDesc:"Sideline: you may force the opponent to reroll all dice. Once Per Game.", category:"Dice Modifier", set:"Frost Valley", designNote:"Frost Valley. One-shot reroll."},
  {id:91, name:"Calvin & Anna", rarity:"rare", maxHp:7, art:"../testroom/art/originals/calvin_anna.jpg", ability:"Frost Surge", abilityDesc:"Win: gain 1 Frostbite. Win: +1 Ice Shard for each Frostbite stack on the enemy sideline.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. Self-fueling Frostbite + Ice engine. Wins generate Frostbite AND convert enemy frostbite stacks into Ice Shards."},
  {id:92, name:"Gary", rarity:"rare", maxHp:6, art:"../testroom/art/originals/gary.jpg", ability:"Lucky Novice", abilityDesc:"Sideline & In Play: gain 2 Ice Shards for each 1 you roll.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley. The real Gary. v598 buff: fires whether Gary is in play or on the sideline. v599 buff: +2 Ice Shards per 1 rolled (was +1). Balance comp: Zain Ice Blade + Skylar Winter Barrage lines just got a serious fuel injection."},
  {id:93, name:"Bandit Pete", rarity:"uncommon", maxHp:5, art:"../testroom/art/originals/bandit_pete.jpg", ability:"Bandit", abilityDesc:"Sideline: if either player rolls only 2 dice, your active Spiritkin gains +3 damage.", category:"Damage Multiplier", set:"Frost Valley", designNote:"Frost Valley. Low-dice sideline booster."},
  {id:103, name:"Night Master", rarity:"ghost-rare", maxHp:5, art:"../testroom/art/originals/night_master.jpg", ability:"Bullseye", abilityDesc:"Win with Doubles: destroy an enemy sideline Spiritkin with less than 4 HP.", category:"Destruction/Instant Kill", set:"Frost Valley", designNote:"Frost Valley ghost-rare. Sideline sniper."},
  {id:104, name:"Skylar", rarity:"ghost-rare", maxHp:7, art:"../testroom/art/originals/skylar.jpg", ability:"Winter Barrage", abilityDesc:"Ice Shards deal +2 damage instead of +1.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley ghost-rare. Ice Shard amplifier."},
  {id:105, name:"Tyler", rarity:"ghost-rare", maxHp:7, art:"../testroom/art/originals/tyler.jpg", ability:"Heating Up", abilityDesc:"Before rolling: spend 2 HP to gain 1 extra die. Sacred Fires deal 2X damage.", category:"Dice Modifier", set:"Frost Valley", designNote:"Frost Valley ghost-rare. HP-for-dice + Sacred Fire doubler."},
  {id:106, name:"King Jay", rarity:"ghost-rare", maxHp:7, art:"../testroom/art/originals/king_jay.jpg", ability:"Reflection", abilityDesc:"Lose roll & dice total = 7: reflect all damage.", category:"Defense/Negation", set:"Frost Valley", designNote:"Frost Valley ghost-rare. Lucky 7 reflector."},
  {id:107, name:"Piper", rarity:"ghost-rare", maxHp:6, art:"../testroom/art/originals/piper.jpg", ability:"Sacred Waters", abilityDesc:"Win with Singles: gain 1 Sacred Fire and 1 Frostbite.", category:"Resource Generation", set:"Frost Valley", designNote:"Frost Valley ghost-rare. Singles win → Sacred Fire + Frostbite. Simple, clean resource engine."},
  {id:113, name:"Prince Balatron", rarity:"legendary", maxHp:6, art:"../testroom/art/originals/balatron.jpg", ability:"Party Time", abilityDesc:"Lose and survive: roll 1 counter die for damage.", category:"Prediction/Reaction", set:"Frost Valley", designNote:"Frost Valley legendary. Counter-attack on loss."},
  {id:114, name:"Romy", rarity:"legendary", maxHp:8, art:"../testroom/art/originals/romy.jpg", ability:"Valley Guardian", abilityDesc:"Predict a die number. If any die matches: +3 damage.", category:"Prediction/Reaction", set:"Frost Valley", designNote:"Frost Valley legendary. Prediction specialist."},
  {id:453, name:"Kaylee", rarity:"ghost-rare", maxHp:6, art:"../testroom/art/originals/Kaylee.jpeg", ability:"Slipstream", abilityDesc:"If any of your dice shows a 2: you may swap one of your dice with one of your opponent's dice.", category:"Dice Modifier", set:"Rolling Hills", tags:["Final 50"], designNote:"A joyful aquatic spirit of impossible intelligence — not a dolphin, not an orca, but its own luminous being that lives in the glassy mirror-still lakes of the Rolling Hills. Slipstream triggers when Kaylee rolls a 2: she swaps it for the opponent's best die. Trade your 2 for their 6. The smartest creature in the water reads the current and redirects it. Playful, optimistic, team-reshaping — you want Kaylee in play as long as possible because she tilts every fight."},
  {id:454, name:"Miyoshi", rarity:"ghost-rare", maxHp:6, art:"../testroom/art/originals/Miyoshi.jpeg", ability:"Bonzai!", abilityDesc:"Before rolling: you may declare 'Bonzai!' — lose 4 HP, then gain 5 extra dice.", category:"Dice Modifier", set:"Volcanic Isles", tags:["Final 50"], designNote:"A ferocious water-and-fire spirit that charges headfirst into everything. Born where volcanic lava meets ocean rapids. The Bonzai ability is the biggest gamble in the game: sacrifice half your HP for a massive dice surge. Players must yell Bonzai at the table to activate."},
  {id:455, name:"Explorer Jeff", rarity:"rare", maxHp:4, art:"../testroom/art/originals/ExplorerJeff.png", ability:"Treasure Hunter", abilityDesc:"Sideline & In Play: if you hold 3+ different specials, gain 1 extra die and deal +1 damage.", category:"Dice Modifier", set:"Volcanic Isles", tags:["Final 50"], designNote:"The 5th Jeff. A chunky happy ghost explorer in a safari hat stomping down a volcanic jungle trail, backpack overflowing with treasures, walking stick in hand. 2 HP sideline card — from the bench he rewards resource diversity. Hold 3 different specials and your whole offense upgrades. Draft differently — you need Lucky Stones AND Healing Seeds AND Sacred Fire, not just one stack."},
  {id:456, name:"Ryder", rarity:"rare", maxHp:5, art:"../testroom/art/originals/Ryder.png", ability:"Toll", abilityDesc:"Before rolling: opponent chooses — take 1 damage or give Ryder 1 Sacred Fire.", category:"Disruption", set:"Dark Castle", tags:["Final 50"], designNote:"Cloaked ghost shark duo on a battlefield — the leader calls the shots. Every round is a lose-lose for the opponent: chip away at their own HP or let Sacred Fire stack for a devastating nuke. Psychological warfare card."},
  {id:457, name:"Sophia", rarity:"rare", maxHp:6, art:"../testroom/art/originals/Sophia.png", ability:"Masquerade", abilityDesc:"Win: you may deal no damage. If you do, gain Mask of Day or Mask of Night. Once Per Game.", category:"Resource Generation", set:"Dark Castle", tags:["Final 50"], designNote:"Ghost of a young girl sitting on castle steps choosing between two masks. Majora's Mask inspired. Mask of Day: gain 1 Burn for each 1 or 2 you roll. Mask of Night: roll the same number of dice as the enemy ghost. Masks are toggleable inventory items like Ice Blade — player can turn them on or off each turn."},
  {id:458, name:"Maisie", rarity:"ghost-rare", maxHp:4, art:"../testroom/art/originals/Maisie.png", ability:"Lucky", abilityDesc:"All your 1s count as 5s.", category:"Dice Modifier", set:"Rolling Hills", tags:["Final 50"], designNote:"Green rabbit spiritkin dashing by a waterfall. Dead simple — every 1 becomes a 5. Low HP balances the power."},
  {id:459, name:"Eli", rarity:"common", maxHp:4, art:"../testroom/art/originals/Eli.png", ability:"Steady", abilityDesc:"Before rolling: gain 1 Lucky Stone.", category:"Resource Generation", set:"Rolling Hills", tags:["Final 50"], designNote:"Shy mossy bush spiritkin hiding behind a tree stump with big dark eyes and antler-like branches. Quietly stockpiles Lucky Stones every round — a slow, steady reroll engine. Low threat but incredible value over time."},
  {id:460, name:"Slicer", rarity:"uncommon", maxHp:6, art:"../testroom/art/slicer.png", ability:"Parting Gift", abilityDesc:"Sideline & In Play: if you win with Quads or better, destroy an enemy sideline Spiritkin.", category:"Disruption", set:"Dark Castle", tags:["Final 50"], designNote:"Copper flame-headed diplomat sipping tea. Looks refined and harmless — but rolling quads lets him assassinate a benched ghost. Skylar's concept."},
  {id:461, name:"Ronan", rarity:"common", maxHp:5, art:"../testroom/art/ronan.png", ability:"Mixup", abilityDesc:"Doubles: gain 1 Ice Shard and 1 Burn.", category:"Resource Generation", set:"Volcanic Isles", tags:["Final 50"], designNote:"Flame-headed Spiritkin meditating under a waterfall. Fire meets water — doubles generate both ice and fire resources."},
  {id:462, name:"Ridley", rarity:"uncommon", maxHp:3, art:"../testroom/art/ridley.png", ability:"Nimble", abilityDesc:"Singles deal +1 damage. Doubles deal +2 damage.", category:"Damage Boost", set:"Rolling Hills", tags:["Final 50"], designNote:"Green rabbit-like Spiritkin dashing through a mossy waterfall. Simple and effective — rewards any winning roll."},
  {id:463, name:"Zork", rarity:"common", maxHp:4, art:"../testroom/art/zork.png", ability:"Smolder", abilityDesc:"Before rolling: discard Burn to gain 1 extra die per Burn discarded.", category:"Dice Modifier", set:"Volcanic Isles", tags:["Final 50"], designNote:"Pterodactyl Spiritkin in a crystal cave. Converts burn fuel into raw dice power."},
  {id:464, name:"Yawn Eater", rarity:"uncommon", maxHp:7, art:"../testroom/art/originals/YawnEater.png", ability:"Feast", abilityDesc:"Gain 1 extra die for each sideline ability on the enemy sideline. Odd Doubles deal +1 damage.", category:"Dice Modifier", set:"Dark Castle", tags:["Final 50"], designNote:"Ghost #200. A smug blobby shadow creature that devours sideline energy. The more passive effects your opponent stacks, the more dice Yawn Eater rolls."}
];


// ================================================================
// RAID BOSSES & MINIONS — IDs 9001+ (bosses), 9101+ (minions)
// ================================================================

const RAID_BOSS_MINIONS = [
  // --- Tyrant minions ---
  {id:9101, name:"War Drummer", rarity:"boss-minion", maxHp:4, art:"../testroom/art/originals/Brock.png",
    ability:"Battle Cadence", abilityDesc:"Sideline: boss deals +1 damage on doubles.",
    bossMinion:true, personality:"tyrant"},
  {id:9102, name:"Shield Bearer", rarity:"boss-minion", maxHp:6, art:"../testroom/art/originals/CastleGuards.png",
    ability:"Phalanx", abilityDesc:"Sideline: boss takes 1 less damage per hit (minimum 1).",
    bossMinion:true, personality:"tyrant"},
  {id:9103, name:"Blood Knight", rarity:"boss-minion", maxHp:5, art:"../testroom/art/originals/DarkFang.png",
    ability:"Siphon", abilityDesc:"Win: boss heals 2 HP from the shared pool.",
    bossMinion:true, personality:"tyrant"},

  // --- Trickster minions ---
  {id:9111, name:"Mimic", rarity:"boss-minion", maxHp:3, art:"../testroom/art/originals/Alucard.png",
    ability:"Copy", abilityDesc:"Sideline: copies the player's sideline ghost passive ability.",
    bossMinion:true, personality:"trickster"},
  {id:9112, name:"Jinxer", rarity:"boss-minion", maxHp:5, art:"../testroom/art/originals/PrincessShade.png",
    ability:"Hex", abilityDesc:"Sideline: player resource generation produces 1 fewer (minimum 0).",
    bossMinion:true, personality:"trickster"},
  {id:9113, name:"Doppelganger", rarity:"boss-minion", maxHp:6, art:"../testroom/art/originals/Shade.png",
    ability:"Mirror Match", abilityDesc:"Rolls the same dice as the player — every round is a tie unless abilities modify.",
    bossMinion:true, personality:"trickster"},

  // --- Swarm Queen minions ---
  {id:9121, name:"Drone", rarity:"boss-minion", maxHp:3, art:"../testroom/art/originals/Cindergrub.png",
    ability:"Expendable", abilityDesc:"No ability. Sacrifice fodder.",
    bossMinion:true, personality:"swarm"},
  {id:9122, name:"Worker", rarity:"boss-minion", maxHp:4, art:"../testroom/art/originals/Beewick.png",
    ability:"Harvest", abilityDesc:"Sideline: boss gains 1 Ice Shard per round.",
    bossMinion:true, personality:"swarm"},
  {id:9123, name:"Soldier", rarity:"boss-minion", maxHp:5, art:"../testroom/art/originals/Champ.png",
    ability:"Formation", abilityDesc:"Doubles deal +2 damage.",
    bossMinion:true, personality:"swarm"},
  {id:9124, name:"Healer Drone", rarity:"boss-minion", maxHp:3, art:"../testroom/art/originals/Cornelius.png",
    ability:"Mend", abilityDesc:"Sideline: boss heals 1 HP from the shared pool per round.",
    bossMinion:true, personality:"swarm"},
  {id:9125, name:"Spitter", rarity:"boss-minion", maxHp:4, art:"../testroom/art/originals/Cyboo.png",
    ability:"Acid Entry", abilityDesc:"Entry: deal 2 damage to player's active ghost.",
    bossMinion:true, personality:"swarm"},

  // --- Glacier minions ---
  {id:9131, name:"Ice Wall", rarity:"boss-minion", maxHp:8, art:"../testroom/art/originals/BubbleBoys.png",
    ability:"Barrier", abilityDesc:"While alive: boss cannot take damage. Must be destroyed first.",
    bossMinion:true, personality:"glacier"},
  {id:9132, name:"Frost Wisp", rarity:"boss-minion", maxHp:3, art:"../testroom/art/originals/Chip.png",
    ability:"Deep Freeze", abilityDesc:"Sideline: Frozen Dice locks player's TWO highest dice instead of one.",
    bossMinion:true, personality:"glacier"},
  {id:9133, name:"Blizzard Elemental", rarity:"boss-minion", maxHp:7, art:"../testroom/art/originals/Millicent.png",
    ability:"Whiteout", abilityDesc:"While active: all player dice are reduced by 1 (minimum 1).",
    bossMinion:true, personality:"glacier"},
  {id:9134, name:"Avalanche", rarity:"boss-minion", maxHp:5, art:"../testroom/art/originals/ancient_one.jpg",
    ability:"Collapse", abilityDesc:"On death: deal 4 damage to player's active ghost.",
    bossMinion:true, personality:"glacier"}
];

const RAID_BOSSES = {
  // ======================== ROLLING HILLS ========================
  raid_timber: {
    id: 'raid_timber',
    name: 'Timber',
    title: 'Dances with Wolves',
    personality: 'tyrant',
    tier: 1, set: 'Rolling Hills',
    requiredBadge: 'dark_fang_slayer', requiredPlayers: 3,
    bossGhost: {
      id: 210, name: 'Timber', maxHp: 18, art: '../testroom/art/timber.jpg',
      ability: 'Howl of the Alpha', abilityDesc: 'Before each roll: remove 1 enemy die. Triples+: deal 1 chip damage to all enemy sideline ghosts.'
    },
    minionsByPhase: { 1: [], 2: [9101], 3: [9101, 9102], 4: [9101, 9103] },
    baseHp: 80, rewardPoints: 50, bonusPoints: 25,
    dialogue: {
      intro: 'The pack answers to no one.',
      phase2: 'You think you can outrun the wolf?',
      phase3: 'The hills belong to ME.',
      phase4: 'AWOOOOOO!',
      defeat: 'The alpha... rests...',
      victory: 'The pack hunts forever.'
    }
  },
  raid_dark_fang: {
    id: 'raid_dark_fang',
    name: 'Dark Fang',
    title: 'The Unseen Predator',
    personality: 'trickster',
    tier: 1, set: 'Rolling Hills',
    requiredBadge: null, requiredPlayers: 2, minPlayers: 1,
    bossGhost: {
      id: 202, name: 'Dark Fang', maxHp: 9, art: '../testroom/art/originals/DarkFang.png',
      ability: 'Pressure', abilityDesc: 'Win: deal +1 damage for each KO\'d ghost this game.'
    },
    minionsByPhase: { 1: [], 2: [], 3: [], 4: [] },
    baseHp: 60, rewardPoints: 50, bonusPoints: 25,
    dialogue: {
      intro: 'I smell fear...',
      phase2: 'Your team is falling apart.',
      phase3: 'No one escapes the dark.',
      phase4: 'THE HUNT ENDS NOW.',
      defeat: 'The shadow... fades...',
      victory: 'Darkness swallows all.'
    }
  },
  raid_jasper: {
    id: 'raid_jasper',
    name: 'Jasper',
    title: 'The Restless Flame',
    personality: 'swarm',
    tier: 1, set: 'Rolling Hills',
    requiredBadge: null, requiredPlayers: 2,
    bossGhost: {
      id: 428, name: 'Jasper', maxHp: 10, art: '../testroom/art/originals/Pickwick.png',
      ability: 'Flame Dive', abilityDesc: 'Win: roll 1 bonus die and deal its value as damage. Jasper takes 1 self-damage. High risk, high reward.'
    },
    minionsByPhase: { 1: [9121, 9122], 2: [9123, 9122], 3: [9124, 9123], 4: [9123, 9125] },
    spawnInterval: { 1: 3, 2: 2, 3: 2, 4: 1 },
    baseHp: 50, rewardPoints: 50, bonusPoints: 25,
    dialogue: {
      intro: 'A wanderer fights hardest when cornered!',
      phase2: 'I have seen every hill and every valley.',
      phase3: 'You cannot stop a force of nature!',
      phase4: 'ONE LAST DIVE!',
      defeat: 'The wanderer... finally rests...',
      victory: 'The road goes ever on.'
    }
  },

  // ======================== FROST VALLEY ========================
  raid_king_jay: {
    id: 'raid_king_jay',
    name: 'King Jay',
    title: 'The Frozen Throne',
    personality: 'glacier',
    tier: 2, set: 'Frost Valley',
    requiredBadge: null, requiredPlayers: 2,
    bossGhost: {
      id: 106, name: 'King Jay', maxHp: 14, art: '../testroom/art/originals/king_jay.jpg',
      ability: 'Reflection', abilityDesc: 'Lose roll & dice total = 7: reflect ALL damage. Permafrost: max 3 damage per hit. Frost Aura: 1 cold damage per round.'
    },
    minionsByPhase: { 1: [9131], 2: [9131, 9132], 3: [9133, 9132], 4: [9134] },
    baseHp: 100, rewardPoints: 100, bonusPoints: 25,
    dialogue: {
      intro: 'The crown of frost answers to no challenger.',
      phase2: 'Your fire grows cold before me.',
      phase3: 'Every kingdom falls to winter.',
      phase4: 'BOW BEFORE THE FROST KING.',
      defeat: 'The crown... melts...',
      victory: 'Winter reigns eternal.'
    }
  },
  raid_romy: {
    id: 'raid_romy',
    name: 'Romy',
    title: 'Seer of the Frozen Vale',
    personality: 'trickster',
    tier: 2, set: 'Frost Valley',
    requiredBadge: 'lucy_slayer', requiredPlayers: 3,
    bossGhost: {
      id: 114, name: 'Romy', maxHp: 20, art: '../testroom/art/originals/romy.jpg',
      ability: 'Valley Guardian', abilityDesc: 'Predicts a die number each round. If any die matches: +3 damage. Mirror Dice: swap 1 die with player after rolling.'
    },
    minionsByPhase: { 1: [9111], 2: [9112], 3: [9112, 9113], 4: [9111, 9112] },
    baseHp: 80, rewardPoints: 100, bonusPoints: 25,
    dialogue: {
      intro: 'I have foreseen your arrival... and your defeat.',
      phase2: 'Every number tells a story.',
      phase3: 'The valley sees ALL.',
      phase4: 'YOUR FATE WAS WRITTEN IN THE ICE.',
      defeat: 'The vision... clears...',
      victory: 'The valley predicted this.'
    }
  },
  raid_mountain_king: {
    id: 'raid_mountain_king',
    name: 'The Mountain King',
    title: 'The Immovable',
    personality: 'tyrant',
    tier: 2, set: 'Frost Valley',
    requiredBadge: null, requiredPlayers: 5,
    bossGhost: {
      id: 110, name: 'The Mountain King', maxHp: 30, art: '../testroom/art/originals/mountain_king_leg.jpg',
      ability: 'Beast Mode', abilityDesc: 'Doubles deal 2X damage. Triples+: deal 2 chip damage to ALL enemy ghosts. On KO: gain 2 Sacred Fire.'
    },
    minionsByPhase: { 1: [], 2: [9101], 3: [9101, 9102], 4: [9103, 9101] },
    baseHp: 120, rewardPoints: 100, bonusPoints: 25,
    dialogue: {
      intro: 'YOU DARE CLIMB MY MOUNTAIN?',
      phase2: 'The peak crushes all who reach it.',
      phase3: 'I AM the mountain!',
      phase4: 'AVALANCHE!',
      defeat: 'The mountain... crumbles...',
      victory: 'The mountain stands forever.'
    }
  },

  // ======================== VOLCANIC ISLES ========================
  raid_pip: {
    id: 'raid_pip',
    name: 'Pip',
    title: 'The Living Ember',
    personality: 'swarm',
    tier: 3, set: 'Volcanic Isles',
    requiredBadge: 'king_jay_slayer', requiredPlayers: 2,
    bossGhost: {
      id: 418, name: 'Pip', maxHp: 11, art: '../testroom/art/originals/Pip.png',
      ability: 'Toasted', abilityDesc: 'Triples+: permanently remove 1 enemy die. +1 die per living minion. Gains 2 Sacred Fires on triples.'
    },
    minionsByPhase: { 1: [9121, 9122], 2: [9123, 9122], 3: [9124, 9123], 4: [9123, 9125] },
    spawnInterval: { 1: 3, 2: 2, 3: 2, 4: 1 },
    baseHp: 100, rewardPoints: 150, bonusPoints: 25,
    dialogue: {
      intro: '*giggle* You wanna play? *giggle*',
      phase2: 'Hehehe! More fire! MORE!',
      phase3: 'Why won\'t you just MELT?!',
      phase4: '*SCREAMING GIGGLE* EVERYTHING BURNS!',
      defeat: '*tiny voice* ...ow...',
      victory: '*delighted spin* Again! Again!'
    }
  },
  raid_humar: {
    id: 'raid_humar',
    name: 'Humar',
    title: 'Herald of the Meteor',
    personality: 'tyrant',
    tier: 3, set: 'Volcanic Isles',
    requiredBadge: 'king_jay_slayer', requiredPlayers: 3,
    bossGhost: {
      id: 336, name: 'Humar', maxHp: 16, art: '../testroom/art/humar.jpg',
      ability: 'Meteor', abilityDesc: 'Win: opponent takes 2 damage before their next roll. Gain 1 Burn. On KO: gain 2 Sacred Fire.'
    },
    minionsByPhase: { 1: [9101], 2: [9101, 9103], 3: [9103, 9102], 4: [9103, 9101] },
    baseHp: 100, rewardPoints: 150, bonusPoints: 25,
    dialogue: {
      intro: 'The blue flame does not forgive.',
      phase2: 'Feel the heat of a thousand suns.',
      phase3: 'The isles burn at my command.',
      phase4: 'METEOR SHOWER!',
      defeat: 'The flame... dims...',
      victory: 'The volcano never sleeps.'
    }
  },
  raid_nerina: {
    id: 'raid_nerina',
    name: 'Nerina',
    title: 'Terror of the Depths',
    personality: 'glacier',
    tier: 3, set: 'Volcanic Isles',
    requiredBadge: 'heart_of_the_hills', requiredPlayers: 5,
    bossGhost: {
      id: 306, name: 'Nerina', maxHp: 35, art: '../testroom/art/the_deep.jpg',
      ability: 'Leviathan', abilityDesc: 'Entry: deal 3 damage. Permafrost: max 3 damage per hit. Frost Aura: 1 damage per round. 9 HP base — a true titan.'
    },
    minionsByPhase: { 1: [9131], 2: [9131, 9132], 3: [9133, 9132], 4: [9134, 9134] },
    baseHp: 120, rewardPoints: 150, bonusPoints: 25,
    dialogue: {
      intro: 'The deep calls... and it is HUNGRY.',
      phase2: 'You are drowning and you don\'t even know it.',
      phase3: 'The ocean swallows kingdoms.',
      phase4: 'LEVIATHAN RISES!',
      defeat: 'The tide... retreats...',
      victory: 'The deep claims all.'
    }
  },

  // ======================== DARK CASTLE ========================
  raid_lucy: {
    id: 'raid_lucy',
    name: 'Lucy',
    title: 'Warden of the Blue Flame',
    personality: 'trickster',
    tier: 4, set: 'Dark Castle',
    requiredBadge: 'dark_castle_key', requiredPlayers: 2,
    bossGhost: {
      id: 108, name: 'Lucy', maxHp: 16, art: '../testroom/art/originals/lucy.jpg',
      ability: 'Blue Fire', abilityDesc: 'Win: gain 1 Sacred Fire. Mirror Dice: swap 1 die. Steal 1 resource on win. Sacred Fires deal double damage.'
    },
    minionsByPhase: { 1: [9111], 2: [9112, 9113], 3: [9113, 9112], 4: [9111, 9113] },
    baseHp: 120, rewardPoints: 200, bonusPoints: 25,
    dialogue: {
      intro: 'Welcome to the castle. You won\'t be leaving.',
      phase2: 'The blue fire sees through all deception.',
      phase3: 'Your resources feed MY flames.',
      phase4: 'THE CASTLE BURNS BLUE.',
      defeat: 'The fire... goes out...',
      victory: 'The castle stands. The fire burns.'
    }
  },
  raid_shade: {
    id: 'raid_shade',
    name: 'Shade',
    title: 'The Endless Whisper',
    personality: 'glacier',
    tier: 4, set: 'Dark Castle',
    requiredBadge: 'dark_castle_key', requiredPlayers: 2,
    bossGhost: {
      id: 111, name: 'Shade', maxHp: 12, art: '../testroom/art/originals/shade.jpg',
      ability: 'Haunt', abilityDesc: 'Before EVERY roll: opponent takes 2 damage. Permafrost: max 2 damage per hit. The tick damage is relentless.'
    },
    minionsByPhase: { 1: [9131], 2: [9131, 9132], 3: [9133, 9134], 4: [9134, 9134] },
    baseHp: 100, rewardPoints: 200, bonusPoints: 25,
    dialogue: {
      intro: '...you shouldn\'t have come here...',
      phase2: '*whisper* ...it hurts, doesn\'t it...',
      phase3: 'The darkness is all that remains.',
      phase4: 'HAUNT. HAUNT. HAUNT.',
      defeat: '...finally... silence...',
      victory: 'The haunting never ends.'
    }
  },
  raid_bigsby: {
    id: 'raid_bigsby',
    name: 'Bigsby',
    title: 'The Omen Bearer',
    personality: 'swarm',
    tier: 4, set: 'Dark Castle',
    requiredBadge: 'dark_castle_key', requiredPlayers: 3,
    bossGhost: {
      id: 424, name: 'Bigsby', maxHp: 10, art: '../testroom/art/originals/Digby.png',
      ability: 'Omen', abilityDesc: 'Win: deal +1 damage. Moonstone use triggers Doom transformation. +1 die per living minion.'
    },
    minionsByPhase: { 1: [9121, 9122], 2: [9123, 9122], 3: [9124, 9123], 4: [9123, 9125] },
    spawnInterval: { 1: 3, 2: 2, 3: 2, 4: 1 },
    baseHp: 100, rewardPoints: 200, bonusPoints: 25,
    dialogue: {
      intro: 'I have dug through the dark... and found only doom.',
      phase2: 'The omen was clear. You should not have come.',
      phase3: 'Doom stirs beneath the castle.',
      phase4: 'THE OMEN IS FULFILLED!',
      defeat: 'The darkness... recedes...',
      victory: 'The omen always comes true.'
    }
  },

  // ======================== THE DARK SPIRE ========================
  raid_valkin: {
    id: 'raid_valkin',
    name: 'Valkin the Grand',
    title: 'The Corruptor',
    personality: 'tyrant',
    tier: 5, set: 'The Dark Spire',
    requiredBadge: 'dark_spire_key', requiredPlayers: 3,
    bossGhost: {
      id: 9012, name: 'Valkin the Grand', maxHp: 25, art: '../testroom/art/originals/ValkinTheGrand.png',
      ability: 'Grand Dominion', abilityDesc: 'Doubles deal 3X damage. Triples+: deal 3 chip to ALL enemies. On KO: gain 3 Sacred Fire. The final boss.'
    },
    minionsByPhase: { 1: [9101, 9102], 2: [9101, 9103], 3: [9103, 9102], 4: [9103, 9103] },
    baseHp: 150, rewardPoints: 300, bonusPoints: 50,
    dialogue: {
      intro: 'So... the little spirits have come to challenge the Grand.',
      phase2: 'I have ruled this castle for millennia.',
      phase3: 'You are NOTHING before my dominion.',
      phase4: 'I. AM. VALKIN. THE. GRAND.',
      defeat: 'The castle... my castle... impossible...',
      victory: 'The Grand reigns supreme. As always.'
    }
  }
};

// Badge definitions for raid progression
// Non-linear gating: Rolling Hills → Frost Valley/Volcanic Isles → Dark Castle → Dark Spire
// Cross-region gates: Lucy's badge unlocks Romy, Heart of the Hills unlocks Nerina
const RAID_BADGES = {
  // Rolling Hills badges (open)
  timber_slayer:     { name: 'Dances with Wolves', icon: '&#x1F43A;', boss: 'raid_timber', tier: 1 },
  dark_fang_slayer:  { name: 'Fang', icon: '&#x1F3D1;', boss: 'raid_dark_fang', tier: 1 },
  jasper_slayer:     { name: 'Trail Blazer', icon: '&#x1F525;', boss: 'raid_jasper', tier: 1 },
  heart_of_the_hills: { name: 'Heart of the Hills', icon: '&#x1F33F;', requires: ['timber_slayer', 'dark_fang_slayer', 'jasper_slayer'], tier: 1 },

  // Frost Valley badges (King Jay + MK open; Romy requires Lucy's badge)
  king_jay_slayer:   { name: 'Ice Scepter', icon: '&#x1F451;', boss: 'raid_king_jay', tier: 2 },
  mountain_king_slayer: { name: 'Mountainbreaker', icon: '&#x26F0;', boss: 'raid_mountain_king', tier: 2 },
  romy_slayer:       { name: 'Veil Piercer', icon: '&#x1F52E;', boss: 'raid_romy', tier: 2 },
  frostborne:        { name: 'Valley Hero', icon: '&#x2744;', requires: ['king_jay_slayer', 'mountain_king_slayer', 'romy_slayer'], tier: 2 },

  // Volcanic Isles badges (Pip+Humar need Mountainbreaker; Nerina needs Heart of the Hills)
  pip_slayer:        { name: 'Smoldering', icon: '&#x1F432;', boss: 'raid_pip', tier: 3 },
  humar_slayer:      { name: 'Meteorfall', icon: '&#x2604;', boss: 'raid_humar', tier: 3 },
  nerina_slayer:     { name: 'The Depths', icon: '&#x1F30A;', boss: 'raid_nerina', tier: 3 },
  dark_castle_key:   { name: 'Dark Castle Key', icon: '&#x1F5DD;', requires: ['pip_slayer', 'humar_slayer', 'nerina_slayer'], tier: 3 },

  // Dark Castle badges (all require Dark Castle Key)
  lucy_slayer:       { name: 'Blue Flame', icon: '&#x1F56F;', boss: 'raid_lucy', tier: 4 },
  shade_slayer:      { name: 'Shady Cloak', icon: '&#x1F47B;', boss: 'raid_shade', tier: 4 },
  bigsby_slayer:     { name: 'Doom Denied', icon: '&#x1F573;', boss: 'raid_bigsby', tier: 4 },
  dark_spire_key:    { name: 'Dark Spire Key', icon: '&#x1F3F0;', requires: ['lucy_slayer', 'shade_slayer', 'bigsby_slayer'], tier: 4 },

  // The Dark Spire — final tier (requires Dark Spire Key)
  valkin_slayer:     { name: 'The Grand', icon: '&#x2694;', boss: 'raid_valkin', tier: 5 },

  // Ultimate — the title Toby's grandfather held
  spiritkin_grand_master: { name: 'Spiritkin Grand Master', icon: '&#x1F31F;', requires: ['heart_of_the_hills', 'frostborne', 'dark_castle_key', 'dark_spire_key', 'valkin_slayer'] }
};

// Raid shop items
const RAID_SHOP_ITEMS = [
  { id: 'pack_spirit', name: 'Spirit Pack', type: 'pack', cost: 150, desc: '5 cards, standard rarity weights' },
  { id: 'pack_premium', name: 'Premium Spirit Pack', type: 'pack', cost: 300, desc: '5 cards, guaranteed rare+' },
  { id: 'pack_legendary', name: 'Legendary Pack', type: 'pack', cost: 800, desc: '3 cards, guaranteed legendary' },
  { id: 'pack_frost', name: 'Frost Valley Pack', type: 'pack', cost: 200, set: 'Frost Valley', desc: '5 Frost Valley cards' },
  { id: 'pack_volcanic', name: 'Volcanic Isles Pack', type: 'pack', cost: 200, set: 'Volcanic Isles', desc: '5 Volcanic Isles cards' },
  { id: 'pack_rolling', name: 'Rolling Hills Pack', type: 'pack', cost: 200, set: 'Rolling Hills', desc: '5 Rolling Hills cards' },
  { id: 'pack_dark', name: 'Dark Castle Pack', type: 'pack', cost: 200, set: 'Dark Castle', desc: '5 Dark Castle cards' }
];

// Helper: look up a ghost by ID (checks regular ghosts, boss minions, AND boss ghosts)
function getGhost(id) {
  return GHOSTS.find(g => g.id === id)
    || RAID_BOSS_MINIONS.find(g => g.id === id)
    || getBossGhost(id);
}

// Helper: look up a boss ghost by boss ID (9001+)
function getBossGhost(bossId) {
  const boss = Object.values(RAID_BOSSES).find(b => b.bossGhost.id === bossId);
  return boss ? boss.bossGhost : null;
}

// Get all non-shelved ghosts
function getActiveGhosts() { return GHOSTS.filter(g => !SHELVED_IDS.has(g.id)); }

// Get non-shelved ghosts by rarity
function getGhostsByRarity(rarity) {
  return getActiveGhosts().filter(g => g.rarity === rarity);
}
