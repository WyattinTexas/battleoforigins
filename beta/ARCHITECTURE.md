# BOO Multiplayer — Architecture

## Simplified Vision (from Wyatt + Gary audit)
Almost nothing on screen. Cards. Packs. Leaderboard. Play. Done.
- 10 games per day first week, then 5 (hook first, restrict later)
- Badges for daily/weekly goals
- Queue up OR challenge link (both — small player base needs links)
- Pack opening that feels like CHRISTMAS (glow, slow flip, screen shake on legendary)
- 3-card team strip with drag-to-reorder above BATTLE button
- Rematch button after every game (one click, run it back)
- Out-of-games state shows leaderboard + badges + countdown (never a dead screen)
- ALL 184 cards from day 1 (modals are fine — turn-based means waiting is expected)
- That's the whole loop

---

## Data Model (Firebase Realtime DB)

Using existing Firebase project: `testroom-75200`

```
/mp/users/{uid}
  displayName: string
  avatar: string (optional)
  collection: [201, 207, 208, ...]     // array of owned ghost IDs
  lastPackOpened: serverTimestamp
  gamesPlayedToday: number
  lastGameReset: serverTimestamp        // when daily games reset
  stats:
    wins: number
    losses: number
    elo: number                         // starts at 1000
  badges: [string, ...]                 // earned badge IDs
  unopenedPacks: number                 // packs waiting to open

/mp/queue/{uid}
  displayName: string
  elo: number
  team: [id, id, id]                    // pre-selected team
  timestamp: serverTimestamp

/mp/games/{gameId}
  red: uid
  blue: uid
  redTeam: [id, id, id]
  blueTeam: [id, id, id]
  state: { ... }                        // full battle state
  pendingAction:
    team: "red" | "blue"
    type: "roll" | "modal" | "swap"
  result: "red" | "blue" | null
  lastUpdate: serverTimestamp

/mp/leaderboard/{uid}
  displayName: string
  wins: number
  losses: number
  elo: number
```

---

## Authentication

Firebase Auth with Google sign-in. One click. No passwords.

Anonymous auth as fallback for trying it out (but collection is lost if browser data cleared — prompt to link Google account).

---

## Pack System

**Starter pack (first login):** 4 cards — 2 common, 1 uncommon, 1 rare

**Weekly packs:** 4 cards, rarity-weighted:
- Slot 1: 100% common
- Slot 2: 70% common, 30% uncommon  
- Slot 3: 40% uncommon, 35% rare, 20% ghost-rare, 5% legendary
- Slot 4: 50% uncommon, 30% rare, 15% ghost-rare, 5% legendary

**Timer:** Firebase server timestamp. Security rules enforce 7-day gap. Can't fake.

**Duplicates:** Allowed. No downside — can't field two of the same card.

---

## Energy System

- **5 games per day** (adjustable)
- Resets at midnight UTC (Firebase server timestamp)
- Counter shown on screen: "3/5 games remaining"
- When you're out, you're out until tomorrow
- Makes each game MATTER

---

## Matchmaking

**Simple queue:**
1. Player picks 3 cards from owned collection
2. Clicks "BATTLE"
3. Written to `/mp/queue/{uid}` with team + elo
4. Client listens for queue changes
5. When 2+ players in queue, lowest elo gap gets matched
6. Game created at `/mp/games/{gameId}`, both removed from queue

**No lobbies, no challenge links for MVP.** Just queue and get matched. If nobody's online, show "Waiting for opponent..." with a cancel button.

---

## Battle Flow (Networked)

Same battle engine as testroom but turn-locked via Firebase:

1. Game state written to `/mp/games/{gameId}/state`
2. `pendingAction.team` = whose turn it is
3. Active player's UI is interactive; opponent sees "Waiting..."
4. Active player rolls → resolves locally → writes new state to Firebase
5. Opponent's `.on('value')` listener picks up the update → renders
6. Modals: set `pendingAction.type = "modal"` → active player resolves → writes result

**Dice:** Client-side (acceptable for friends/family). Server validation later if needed.

---

## Badges

Simple achievement system:

| Badge | Requirement |
|---|---|
| First Blood | Win your first game |
| Pack Rat | Open 5 packs |
| Winning Streak | Win 3 games in a row |
| Top 10 | Reach top 10 on leaderboard |
| Collector | Own 50 cards |
| Legendary Pull | Open a legendary from a pack |
| Full House | Own cards from all 5 sets |
| Underdog | Win with all commons team |

Stored as string array in user profile. Checked after each game/pack opening.

---

## File Structure

```
/Users/drbango/DrBango/multiplayer/
  index.html          -- Single page: auth, collection, packs, queue, battle, leaderboard
  style.css           -- Minimal, beautiful, dark theme matching testroom
  app.js              -- All game logic: auth, packs, collection, queue, battle
  cards.js            -- GHOSTS array (shared with testroom)
  ARCHITECTURE.md     -- This file
  VISION.md           -- Wyatt's simplified vision
```

**Why one HTML file?** Matches the testroom pattern. Simple to deploy. No build system.

**Card data:** Extract GHOSTS array into `cards.js`, imported by both testroom and multiplayer via `<script src>`.

---

## UI Layout (Minimal)

```
┌──────────────────────────────────────────┐
│  BOO! Spirit Battles          3/5 games  │
│  [Your Name]  Elo: 1247                  │
├──────────────────────────────────────────┤
│                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Card │ │Card │ │Card │ │Card │ ...    │
│  │  1  │ │  2  │ │  3  │ │  4  │       │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│                                          │
│  [🎁 Open Pack (1 available)]            │
│                                          │
│  [ ⚔️  BATTLE  ]                        │
│                                          │
│  ── LEADERBOARD ──                       │
│  1. PlayerA  1450 elo  42W-12L           │
│  2. PlayerB  1380 elo  35W-15L           │
│  3. You      1247 elo  20W-18L           │
│                                          │
│  ── BADGES ──                            │
│  🏆 First Blood  📦 Pack Rat  🔥 ...    │
└──────────────────────────────────────────┘
```

---

## MVP Phases

| Phase | What | Days |
|---|---|---|
| 1 | Auth + collection + packs + UI | 2-3 |
| 2 | Queue + battle (vs AI first) | 2-3 |
| 3 | Real PvP over Firebase | 3-4 |
| 4 | Leaderboard + badges + polish | 1-2 |
| **Total** | | **8-12 days** |

---

## Security Rules

```json
{
  "rules": {
    "mp": {
      "users": {
        "$uid": {
          ".read": "auth.uid === $uid",
          ".write": "auth.uid === $uid",
          "lastPackOpened": {
            ".validate": "newData.val() === now && (!data.exists() || now - data.val() >= 604800000)"
          }
        }
      },
      "queue": {
        ".read": true,
        "$uid": { ".write": "auth.uid === $uid" }
      },
      "games": {
        "$gameId": {
          ".read": true,
          ".write": "auth != null"
        }
      },
      "leaderboard": {
        ".read": true,
        "$uid": { ".write": "auth.uid === $uid" }
      }
    }
  }
}
```

---

## The Modal Problem

15 interactive modals in the battle engine need network support. For MVP:
- Start with cards that have NO complex modals (no Timber, Romy, Winston, etc.)
- Add modal-heavy cards incrementally
- Each modal type needs: serialize choice → write to Firebase → opponent reads result

This is the biggest engineering challenge. Solve it for Moonstone (most common modal) first, then generalize.

---

## What We're NOT Building (per Wyatt)
- No chat
- No friends list  
- No deck saving
- No tournament mode
- No spectating
- No settings
- None of that. Just play.
