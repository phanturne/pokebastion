# PokéBastion TD — Prototype Specification

**Target:** Playable vertical-slice prototype validating open-map real-time tactical defense, live A* pathfinding around player-built walls, two-ring AP repositioning, and Pokémon combat/abilities across 3 waves.

---

## 1. Battlefield & Grid

- **Grid Dimensions:** `18 × 12` square tiles (`48 × 48` display pixels per tile, `864 × 576` battlefield).
- **Canvas Size:** `1280 × 720` (`pixelArt: true`, nearest-neighbor scaling, `Phaser.Scale.FIT`).
  - Left/Center (`864 × 576` offset): Tactical Grid Battlefield.
  - Top Bar (`72px` height): Wave counter, Phase badge (`PREPARATION` / `COMBAT`), Core HP bar, Pokédollars (`₽`), Shared AP (`AP / 10`), Speed toggle (`1×` / `2×`), Credits button.
  - Right Panel (`380px` width): Selected Unit / Structure inspector, Build Palette (Prep), Roster / Reserve Swap, Ultimate trigger & Auto-Cast toggle.
- **Central Objective:** `2 × 2` **Bastion Core** at grid `(8..9, 5..6)` with `1000 HP`.
- **Spawn Zones:**
  - **West Spawn:** `(0, 4..7)`
  - **East Spawn:** `(17, 4..7)`
  - 1-tile no-build buffer directly in front of spawn zones (`(1, 4..7)` and `(16, 4..7)`).
- **Terrain:** Grass, dirt trails, and 2 small water moat tiles (`(5, 5..6)` and `(12, 5..6)`) that block ground units & Diglett burrowing, while Flying units (Zubat) cross freely.

---

## 2. Pathfinding & Enemy Behavior

- **Live A\* Pathfinding:** 4-directional orthogonal A\* from each spawn zone to the nearest cell of the `2 × 2` Core.
- **Live Preview Lines:** During Preparation Phase, dashed path preview lines update immediately whenever a wall/structure is placed, moved, or sold.
- **All-Routes-Blocked Fallback:** If no valid ground path exists to the Core, ground enemies path to the nearest blocking wall/structure and attack it until a path opens.
- **4 Enemy Types:**
  1. **Rattata (`0019`, Basic):** Ground movement, moderate speed, attacks Core or blocking walls.
  2. **Diglett (`0050`, Burrower):** Burrows under player-built walls (ignores walls in pathfinding), but **cannot** cross water moat tiles.
  3. **Zubat (`0041`, Flying):** Flies over walls and water directly toward the Core; cannot be blocked by walls.
  4. **Geodude (`0074`, Structure Breaker):** Ground movement, deals `2.5×` damage to walls/structures and prefers attacking adjacent walls if obstructed.

---

## 3. Playable Pokémon Roster (10 Species)

Players start with **4 Active Pokémon** (`Pikachu`, `Charmander`, `Bulbasaur`, `Snorlax`) and **2 Reserve Pokémon** (`Squirtle`, `Geodude`), with **4 additional species** (`Gengar`, `Butterfree`, `Eevee`, `Lucario`) available via between-wave recruitment or roster swap testing. Max `6` active, `3` reserve slots in prototype.

| Pokémon | ID | Class | Move | Range | Basic Attack | Passive | Ultimate (Manual / Auto) |
|---|---|---|---|---|---|---|---|
| **Pikachu** | `0025` | Blaster | 2 | 3 | Lightning Bolt projectile | +10% Ult charge per attack | **Thunderstrike:** AoE lightning at target tile (`lightning-strike`) |
| **Charmander** | `0004` | Blaster | 2 | 3 | Fireball projectile | Attacks apply Burn (DoT) | **Inferno Blast:** AoE fire explosion (`fireball-impact`) |
| **Bulbasaur** | `0001` | Support | 2 | 2 | Vine/Seed hit | Nearby allies +10% ATK | **Synthesis Bloom:** Heals nearby allies (`bloom-heal`) |
| **Squirtle** | `0007` | Defender | 2 | 2 | Water Bolt projectile | +25% DEF near water/walls | **Tidal Surge:** Knockback + AoE splash (`tidal-wave`) |
| **Snorlax** | `0143` | Defender | 1 | 1 | Heavy melee slam | -25% damage taken when stationary | **Body Slam:** AoE stun + knockback (`rock-shatter`) |
| **Gengar** | `0094` | Specialist | 3 | 2 | Shadow Bolt | Bonus dmg to debuffed foes | **Void Implosion:** AoE shadow burst (`void-implosion`) |
| **Geodude** | `0074` | Defender | 1 | 1 | Rock Smash melee | +30% DEF adjacent to walls | **Rock Tomb:** AoE rock shatter (`boulder-toss`) |
| **Butterfree** | `0012` | Support | 3 | 3 | Pollen bolt (slows) | Slows last 50% longer | **Sleep Powder:** AoE stun/slow (`bloom-heal`) |
| **Eevee** | `0133` | Brawler | 3 | 1 | Quick Slash melee | +20% Attack Speed | **Swift Fury:** Rapid multi-hit (`sword-combo`) |
| **Lucario** | `0448` | Brawler | 3 | 1 | Aura Strike melee | Crits every 4th hit | **Aura Storm:** High-dmg AoE slash (`sword-combo`) |

---

## 4. Tactical Movement & Shared AP

- **Shared Pool:** Starts at `8 AP`, max `10 AP`.
- **Two-Ring Movement:** Selecting a Pokémon during Combat (or freely during Prep for `0 AP`) highlights:
  - **Standard Ring** (`dist <= moveRange`, Cyan): **1 AP**
  - **Extended Ring** (`moveRange < dist <= 2 * moveRange`, Amber): **2 AP**
- **Slow-Mo Aiming:** Holding/selecting a Pokémon for movement or manual ultimate during Combat slows time to `0.35×` for comfortable real-time control.
- **AP Recovery:** `+3 AP` after each wave; `+1 AP` per `6` enemy kills during combat.

---

## 5. Construction, Economy & Progression

- **Starting Pokédollars:** `₽140`.
- **Structures (Preparation Phase):**
  - **Wooden Barricade** (`₽20`, 120 HP): Cheap ground blocker.
  - **Stone Wall** (`₽50`, 300 HP): Durable ground blocker.
  - **Berry Bush** (`₽70`, 150 HP): Heals adjacent Pokémon `8 HP/s`.
  - **Explosive Barrel** (`₽30`, 40 HP): One-time consumable; explodes (`big-explosion`, 120 AoE dmg) when destroyed or manually detonated.
- **Ruined State & Repair:** Destroyed walls/Berry Bushes enter a ruined state (non-blocking/inactive) and can be repaired for `50%` of build cost. Unconsumed structures can be moved for free or sold for `70%` refund during Prep.
- **Fainting & Revival:** Fainted Pokémon cannot act; revive during Prep for `₽80` (50% HP), or heal wounded Pokémon for `₽30` (50% HP).
- **3-Wave Loop:**
  - **Wave 1:** Rattata + Geodude (West & East trickle).
  - **Wave 2:** Rattata + Diglett + Zubat (tests wall bypasses & flying).
  - **Wave 3:** Heavy mixed assault (Rattata, Diglett, Zubat, Geodude surge).
- **Between-Wave Roguelike Rewards (Pick 1 of 3):**
  - **Upgrades:** *Sharp Claws* (+25% Team ATK), *Swift Boots* (+1 Move Range to all), *Quick Charge* (+30% Ult Charge), *Thick Hide* (+30% Team Max HP).
  - **Artifacts:** *Fortification Core* (+40% Wall HP), *Temporal Gear* (+1 AP every 4 kills instead of 6), *Arcane Conduit* (+20% ATK Speed), *Commander's Insignia* (+25% Pokédollar bounties).
  - **Recruitment:** Recruit an unowned Pokémon from the 10-species pool.

---

## 6. Asset Integration & Credits

- **Tiles:** MPWSP01 (`tileset.png`, 16×16 scaled 3× to 48×48).
- **Pokémon Sprites:** PMDCollab SpriteCollab (`Walk-Anim.png`, `Idle-Anim.png`, `Attack-Anim.png`, `AnimData.xml`) for 8-directional animations; procedural fallback if any sheet fails to load.
- **Attack VFX:** PVFX Foundry (`lit/grid/sprite-sheet.png` + `manifest.json`) for elemental projectiles, impacts, healing, and explosions.
- **Placeholders:** See [placeholders.md](file:///Users/krding/Projects/pokebastion/docs/placeholders.md) for any procedural graphics used for UI icons/structures.
