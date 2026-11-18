Idea: Roguelike Tower Defense with no fixed paths. Build walls/obstacles at end of wave. Units can be moved during combat using action points like PtN. Different units can move different distance with action point. Farther away requires more action point and cooldown before they can move again? Get random award and artifacts. Units can be upgraded and equip artifacts

# PokéBastion TD

## Game Design Document

**Genre:** Real-time tactical defense / Roguelike / Strategy  
**Core Inspiration:** The Last Spell, Arknights, Path to Nowhere  
**Setting:** Pokémon-inspired world  
**Core Experience:** Command a team of Pokémon, construct and upgrade defenses, manipulate enemy movement, and survive increasingly dangerous waves.

---

# 1. Game Overview

## Core Concept

A roguelike tactical defense game combining wave-based survival and between-wave base-building, real-time unit repositioning, and distinct character abilities and progression. Players command a team of Pokémon defending central objective(s) against increasingly dangerous waves of wild Pokémon.

Unlike traditional tower defense games, enemies do not follow predetermined paths. The battlefield is a **grid**, and enemies navigate across it toward the player's core, taking available routes around obstacles and defensive structures. Players can construct walls, obstacles, and defensive structures on grid cells to shape the battlefield. Walls and persistent structures have durability values, entering a ruined state when destroyed so they can be repaired, while one-time use items disappear once consumed.

Combat is real-time. Pokémon remain stationed in grid cells and automatically perform their basic attacks, while the player actively repositions them to nearby cells (limited by each Pokémon's movement stat and action points) and triggers manual ultimates (while some Pokémon feature auto-cast ultimates). Between waves, players spend limited Pokédollars to construct defenses, repair and upgrade structures, heal or revive Pokémon, and improve their team. Each run features randomized rewards, upgrades, and artifacts, creating different team compositions and defensive strategies.

## Design Pillars

1. **Open tactical battlefields:** No fixed enemy paths. Players influence enemy routes by constructing defenses.
2. **Real-time tactical control:** Pokémon automatically attack while players decide when to move units and activate abilities.
3. **Persistent fortification:** Defensive structures remain throughout a run and can be repaired, upgraded, or destroyed.
4. **Meaningful preparation:** Pokédollars is limited, so players must prioritize construction, repairs, healing, and upgrades.
5. **Distinct Pokémon identities:** Every Pokémon has unique passive abilities, basic attacks, and ultimate abilities (manual or auto-cast depending on the Pokémon).
6. **Roguelike variety:** Random rewards, artifacts, recruitment, and upgrades create different builds across runs.
7. **Adaptation and survival:** Every wave challenges the player's defensive setup, requiring adjustments to team positioning and fortifications.

---

# 2. Core Gameplay Loop

A run consists of multiple encounters or stages. Each encounter contains several consecutive enemy waves.

## Between Waves: Preparation Phase

After defeating a wave, players enter a preparation phase.

Players can spend Pokédollars and other available resources to:

- Build walls and obstacles.
- Construct defensive structures and traps.
- Repair damaged walls and structures.
- Upgrade existing fortifications.
- Access the **preparation shop** (available whenever not in combat) to purchase revives, healing items, held items, and other consumables.
- Heal injured Pokémon or revive fainted Pokémon.
- Upgrade Pokémon abilities and stats.
- Equip or swap **held items** on Pokémon (up to 3 items per Pokémon by default).
- Swap Pokémon between the active team and reserve roster.
- Reposition Pokémon before the next wave.

Construction and upgrades are not free. Pokédollars is a limited resource, so players must decide whether to invest in stronger defenses, recover their team, or improve their offensive capabilities. The preparation phase should create meaningful trade-offs. Players should rarely have enough Pokédollars to do everything they want.

## During Waves: Combat Phase

When a wave begins:

- Wild Pokémon spawn from designated **multi-cell spawn zones** (typically 2–4 tiles wide, with active zones telegraphed during preparation).
- Enemies navigate the open battlefield toward the player's core.
- Pokémon automatically perform their basic attacks against enemies within their attack range.
- Players manually activate tactical ultimates (while auto-cast ultimates trigger automatically when charged).
- Players reposition Pokémon using movement action points.
- Enemies attack Pokémon, walls, and defensive structures according to their behaviors.
- Walls and structures can take damage and be destroyed.
- Defeating enemies provides rewards or resources according to the encounter rules.

The wave ends when all enemies are defeated or the core is destroyed.

## Run Progression

Between major encounters, players may receive:

- Pokémon recruitment opportunities.
- Pokémon upgrades.
- Global artifacts.
- Held items.
- Pokédollars and other resources.
- Healing or revival opportunities.
- Special encounters and elite battles.

A run eventually culminates in a boss encounter.

---

# 3. Battlefield and Enemy Pathfinding

## Open-Map Combat

The battlefield is a **square-grid** open map rather than a fixed-path tower-defense layout. The primary defensive objective is a central core—typically occupying **4 cells (2×2)** so it cannot be cheaply sealed off with four walls and enemies can surround it naturally (while maps with multiple smaller objectives may use **1×1** structures). Enemies attempt to reach the objective using available routes across the square grid. Players influence enemy movement by building walls and defensive structures on grid tiles, creating straight chokepoints and controlling important areas.

The battlefield should offer multiple viable defensive strategies rather than one optimal placement pattern.

## Enemy Pathfinding Rules

Most enemies prioritize reaching the core rather than attacking walls.

Their general behavior:

1. Identify a valid route toward the core.
2. Navigate around walls and obstacles.
3. Attack Pokémon or structures when their behavior or circumstances require it.
4. Continue toward the core when a valid route is available.

Walls and defensive structures influence enemy pathfinding. Enemies pick the shortest valid path (splitting evenly across tied routes), detouring around walls unless all routes are blocked or a detour exceeds ~2.5× straight-line distance. Enemies stay focused on reaching the core unless blocked by or engaged with a frontline Pokémon, and **live pathfinding preview lines** are shown during the preparation phase whenever players place or move walls.

### When All Routes Are Blocked

If the player completely blocks every valid route to the core, enemies have no choice but to respond to the obstruction.

Potential behaviors include:

- Attack the nearest blocking wall.
- Attack a designated defensive structure.
- Use a special movement ability to bypass the obstruction.
- Search for another route if one becomes available.

Most ordinary enemies should attack blocking walls rather than remain permanently stuck. Certain enemies should specialize in bypassing or destroying defenses. This creates a strategic trade-off: walls can redirect enemies and create chokepoints, but excessive fortification may force enemies to attack the defenses directly.

### Enemy Pathfinding Considerations

Pathfinding should account for:

- Wall durability (only for intelligent enemies)
- Movement restrictions.
- Terrain types.
- Enemy-specific movement abilities.
- Distance to the core.
- Available alternative routes.

Enemy behavior should be readable. Players should be able to understand why enemies choose a route or attack a particular obstacle.

---

# 4. Construction and Defensive Structures

Construction is one of the game's central mechanics. Players can build defensive structures anywhere on the battlefield that is not blocked by terrain or otherwise restricted by placement rules. All construction requires Pokédollars.

## Walls and Obstacles

Walls are used to manipulate enemy movement and create defensive chokepoints. Walls persist throughout the entire run unless destroyed. Different wall types have different durability, costs, and defensive properties.

Potential wall types (flavored as natural obstacles and Pokémon-world barriers rather than modern military walls):

| Wall Type                | Characteristics                         |
| ------------------------ | --------------------------------------- |
| Wooden Barricade / Hedge | Cheap, low durability                   |
| Reinforced Timber Wall   | More expensive, higher durability       |
| Boulder / Rock Tomb      | High durability, expensive to construct |

### Wall Durability

Walls have HP and can be damaged by enemies. When a wall reaches zero HP, it is destroyed, displays a **ruined state**, and no longer blocks movement until repaired.

Players can:

- Repair damaged walls.
- Upgrade walls to stronger variants.
- Replace destroyed walls.
- Construct new walls in different locations.

Repairing and upgrading walls requires Pokédollars.

### Persistent Fortifications

Walls remain in their constructed locations throughout the run, including between waves and potentially between encounters depending on the map structure. Their persistence makes long-term defensive planning important.

Players must consider:

- Which walls are worth protecting?
- Where should they spend Pokédollars on upgrades?
- Is it better to repair a damaged wall or build a new one?
- Should they redirect enemies rather than try to block them completely?

## Defensive Structures

Players can construct defensive structures anywhere valid on the battlefield. To preserve the Pokémon identity, **Pokémon remain the sole source of active combat damage and entry hazards**, while buildable structures focus on terrain control, team support, field logistics, and one-time tactical consumables.

Potential structures:

| Structure                          | Function                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Field Healing Station / Berry Bush | Restores HP to nearby Pokémon                                                                                |
| Type Shrine / Buff Beacon          | Improves nearby Pokémon's combat performance or elemental attacks                                            |
| Resource Collector                 | Produces Pokédollars or berries at the end of each wave it survives (preventing wave-stalling)               |
| One-Time Use Item                  | Consumable deployables (e.g., Explosive Barrel) that trigger an immediate effect when activated or destroyed |

Structures require Pokédollars to construct. Persistent structures have durability: when reduced to zero HP, they display a **ruined state** and stop functioning until repaired with Pokédollars during the preparation phase. In contrast, **one-time use items** (such as explosive barrels) **disappear permanently** after being triggered or destroyed. Structures should complement Pokémon rather than replace them as the primary source of combat power.

### Structure Upgrades, Selling, and Baseline Costs

- **Linear Upgrades:** Structures upgrade linearly (e.g., Tier 1 → Tier 2 → Tier 3) rather than branching, keeping buildcrafting focused on Pokémon.
- **Moving & Selling:** During the preparation phase, players can **freely move placed walls, structures, and unconsumed items** across valid grid cells, or **sell/salvage them for a 70% Pokédollar refund**.
- **Baseline Cost Ratios (assuming ~₽80–₽120 earned per early wave):**
  - Walls: Wooden Barricade `₽20`, Reinforced Timber `₽45`, Boulder / Rock Tomb `₽80`, Screen Barrier `~₽70`.
  - Support Structures: `₽60–₽100`.
  - One-Time Use Items: `₽25–₽35`.
  - Repairs: Damaged (standing) structures cost proportionally up to ~40% of build cost; **ruined-state** structures cost ~50%–60% of build cost to restore.

## Construction Limitations

To prevent players from creating an impenetrable fortress:

- Every structure costs Pokédollars.
- Construction opportunities are limited by available resources.
- Structures can be damaged or destroyed.
- Some enemies specialize in bypassing or destroying defenses.
- Maps may have terrain restrictions and **no-build buffers** around enemy spawn zones (preventing players from building on spawn cells or 1–2 tiles directly in front of them).
- Stronger structures should require more substantial investment.

The objective is to make construction a strategic investment rather than an unlimited way to create a perfect maze.

---

# 5. Pokémon Unit System

Players command a team of Pokémon during each encounter.

## Team Size

**Maximum roster: 6 active Pokémon and 6 reserve Pokémon (12 total).**

The active team participates in combat, while reserve Pokémon are available for substitution between waves. Players can swap Pokémon between active and reserve positions during preparation phases, providing tactical flexibility without requiring players to manage an excessively large active team.

### Starting Draft (10-Point Budget)

Before starting a run, players draft their initial active team using a **10-point budget** from their unlocked Pokémon collection:

- Different Pokémon have different **point costs** based on their baseline strength and rarity (e.g., 1–3 points for common/early-route Pokémon, 4–6+ points for stronger or rarer Pokémon).
- Players can spend their 10 points to draft **1 to 6 starting Pokémon**—choosing between a "tall" start (fewer, stronger Pokémon) or a "wide" start (more lower-cost Pokémon for broader Wave 1 coverage).
- Any remaining active slots (up to 6) and all 6 reserve slots are filled through in-run recruitment.

### Pokémon Attributes

Each Pokémon has attributes such as:

- Health (HP)
- Attack
- Defense
- Attack range
- Attack speed
- Movement range
- Ultimate energy or cooldown
- Other Pokémon-specific characteristics

## Core Abilities

Every Pokémon has three core components.

### 1. Passive Ability

An automatically active effect that defines the Pokémon's identity.

Examples:

- Pikachu periodically gains bonus energy when attacking.
- Snorlax takes reduced damage while stationary.
- Butterfree improves the effectiveness of nearby status effects.
- Geodude gains defense while adjacent to walls.

### 2. Basic Attack

The Pokémon's standard attack behavior.

Examples:

- Pikachu: Ranged electric projectile.
- Snorlax: Short-range heavy physical attack.
- Butterfree: Ranged attack that can apply a status effect.
- Geodude: Physical attack with high impact against nearby enemies.

Basic attacks happen automatically when valid targets are within range. By default, Pokémon target the **nearest enemy** in range, with future support for per-unit targeting priority options (e.g., nearest to core, strongest, or lowest HP). They should have distinct ranges, attack patterns, and effects.

### 3. Ultimate Ability

A powerful, high-impact ability triggered when charged. Ultimates charge through a **mix of attacking, enemy kills, and passive time/Support recovery**. Depending on the Pokémon, an ultimate is either **manually activated** by the player (for precise tactical timing, such as targeted AoE strikes, teleports, or knockbacks) or **auto-cast** automatically when ready (for consistent tempo and reduced micromanagement). To keep real-time control comfortable, the game supports **slow-motion while dragging/aiming** (and optional tactical pause).

Examples:

- Pikachu: Large-area lightning strike.
- Snorlax: Powerful slam that damages and knocks back nearby enemies.
- Butterfree: Releases a cloud that puts enemies to sleep.
- Gengar: Teleports and creates a damaging shadow zone.

Ultimate abilities should create important tactical moments rather than simply provide larger damage numbers.

## Pokémon Classes and Subclasses

Every Pokémon belongs to **1 or 2 classes** (each with a specific **subclass**). Parent classes drive **class-based minor upgrades** and **class artifact synergies**, while subclasses define a Pokémon's baseline combat behavior on the grid.

| Class          | Purpose                                               | Subclasses                                                                                                                                              |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Defender**   | Frontline tanking, blocking, and wall/core protection | **Bastion** (high HP/armor), **Wallguard** (fortifies/shields adjacent walls), **Juggernaut** (counterattacks/self-heal)                                |
| **Brawler**    | Close-range melee dueling and frontline damage        | **Duelist** (single-target DPS), **Cleave** (hits multiple adjacent enemies), **Interceptor** (low AP cost to chase leaks)                              |
| **Marksman**   | Long-range attacks and priority targeting             | **Sniper** (extreme range/anti-flyer), **Rapid-Fire** (high attack speed), **Artillery** (long-range splash)                                            |
| **Blaster**    | Elemental AoE damage and crowd clearing               | **Elemental AoE** (wide burst), **Chain** (bouncing attacks), **Status** (group Burn, Paralyze, Freeze, etc.)                                           |
| **Support**    | Healing, buffs, shields, and AP/cooldown aid          | **Healer** (HP & status restore), **Buffer** (speed/damage/type buffs), **Tactician** (AP & ultimate charge recovery)                                   |
| **Specialist** | Entry hazards, terrain control, mobility, and debuffs | **Hazard Setter** (_Spikes_, _Toxic Spikes_, _Sticky Web_, _Stealth Rock_), **Displacer** (push/pull/slow), **Ambusher** (cheap repositioning/teleport) |

A Pokémon's class does not need to be determined exclusively by its elemental type, and dual-class Pokémon can draw minor upgrades from both of their class pools.

---

# 6. Tactical Movement and Action Points

One of the game's central mechanics is the ability to reposition Pokémon during real-time combat. Pokémon can be moved across battlefield tiles on the fly while enemies are actively advancing and attacking.

## Movement Action Points (AP)

Each Pokémon has a **Movement Range** stat that defines two movement rings on the grid:

- **Standard Ring (Within Movement Range):** Move to any reachable tile within the Pokémon's base Movement Range for **1 AP** (standard cost).
- **Extended Ring (Up to 2× Movement Range):** Move to a tile beyond base Movement Range—up to **double** the Pokémon's Movement Range—for **2 AP** (double cost).

For example, a Pokémon with a Movement Range of **2 tiles** pays:

| Movement Ring | Distance  | AP Cost |
| ------------- | --------- | ------- |
| Standard Ring | 1–2 tiles | 1 AP    |
| Extended Ring | 3–4 tiles | 2 AP    |

Different Pokémon have different movement characteristics:

- Fast Pokémon have a larger Movement Range, letting them cover more ground per AP.
- Heavy Pokémon have a smaller Movement Range.
- Flying Pokémon can ignore certain terrain restrictions.
- Teleporting Pokémon can bypass obstacles using special movement abilities.
- By default, Pokémon **cannot** move through or end on occupied tiles (unless using a special flying or teleporting ability).
- Ground Pokémon cannot cross walls or deep water; **Water-type** Pokémon can stand on water tiles, and **Flying** Pokémon can cross walls/water (though they cannot stop on walls).
- Repositioning executes as a quick, **uninterruptible** dash/hop to the target cell.

## AP Recovery

Movement action points are a **shared team resource** (one unified AP pool rather than per-Pokémon pools). To **prevent wave-stalling** (such as trapping a lone weak enemy to farm infinite AP), AP does **not** regenerate passively from elapsed wave time.

Target system:

- The team shares a **10–12 AP** maximum capacity (expandable via artifacts or Support upgrades).
- Moving any Pokémon spends from the shared AP pool (`1 AP` for standard range, `2 AP` for extended double range).
- **Between waves:** Restores **+3 to +4 AP** automatically after each wave (unused AP banks up to the cap).
- **During combat (kill-driven):** Restores **+1 AP per ~6–8 enemy kills**, plus bursts from Support (Tactician) abilities and artifacts.

There is no additional movement cooldown. Movement is limited by available AP, not by a separate cooldown timer. This creates a long-term resource decision: reposition aggressively now or preserve mobility for later waves.

## Movement Design Goals

Movement should be meaningful but responsive. Players should be encouraged to reposition Pokémon when the situation changes, without being able to move their entire team across the battlefield without cost.

Movement should create tactical decisions about:

- Which Pokémon should respond to a threat?
- Is the movement cost worth the positional advantage?
- Should a Pokémon remain in a strong position?
- Should the player save AP for a more dangerous upcoming wave?

---

# 7. Pokémon Fainting and Recovery

Pokémon can faint when their HP reaches zero. A fainted Pokémon can no longer attack, move, or activate abilities. Fainted Pokémon remain unavailable until revived.

## Revival

Players can revive fainted Pokémon during the preparation phase. Revival requires resources, such as Pokédollars or special revival items.

Revival rules:

- Standard **Revives** (`₽80–₽100` base, scaling slightly by wave or draft cost) restore **50% maximum HP** (while pricier Max Revives restore 100% HP).
- Revived Pokémon suffer **no extra post-faint debuff** beyond returning at partial HP and costing Pokédollars.
- Some special rewards can provide free or discounted revival.

The purpose is to make losing a Pokémon consequential without necessarily ending the run immediately.

## Challenge Modifiers

Certain difficulty modifiers can restrict revival.

Examples:

- No revivals allowed.
- Revival costs increased.
- Revived Pokémon return with reduced HP.
- Fainted Pokémon cannot be used for the remainder of the encounter.
- Limited revival items per run.

These modifiers provide additional difficulty for experienced players.

---

# 8. Enemies and Wild Pokémon

Wild Pokémon are the primary enemies. Each species should have a distinctive combat identity, movement behavior, and interaction with the battlefield.

## Enemy Categories

- Basic enemies: Ordinary threats that test the player's defenses.
- Fast enemies: Move quickly and exploit openings.
- Armored enemies: Require focused damage or specialized attacks.
- Ranged enemies: Attack from a distance.
- Flying enemies: Bypass ordinary ground defenses.
- Burrowing enemies: Pass beneath certain obstacles.
- Disruptors: Disable or debuff defensive Pokémon.
- Structure breakers: Prioritize damaging walls and defensive structures.
- Elite enemies: Stronger enemies with multiple abilities.
- Bosses: Unique encounters with special mechanics and phases.

## Enemy Examples

| Enemy     | Movement / Combat Behavior                                                      |
| --------- | ------------------------------------------------------------------------------- |
| Rattata   | Ordinary ground movement                                                        |
| Diglett   | Can burrow underground and pass beneath walls, but cannot burrow through a moat |
| Zubat     | Flies over ground obstacles and walls                                           |
| Geodude   | Can break certain destructible obstacles                                        |
| Abra      | Can teleport past obstacles                                                     |
| Tentacool | Can travel through water and aquatic terrain                                    |

## Enemy Design Philosophy

Enemies should challenge different parts of the player's defensive setup.

For example:

- Diglett challenges wall-based defenses.
- Zubat challenges ground-focused teams.
- Geodude challenges weak structures.
- Abra challenges static positioning.
- Ranged enemies punish exposed Pokémon.
- Fast enemies punish poorly defended objectives.

Difficulty should come from enemy interactions and battlefield pressure, not merely inflated HP and damage numbers.

## Wave Generation and Enemy Scaling

Waves are generated procedurally from a **strength budget** rather than hand-authored one by one, keeping total difficulty predictable while varying enemy compositions across runs.

### Wave Themes and Cadence

- **Standard Waves (Regular Waves):** Draw from the map's biome pool using light sub-flavors (such as _Balanced_, _Vanguard_, or _Skirmish_) and varied spawn pacing (steady streams, surges, or multi-zone splits).
- **Difficult Theme Waves (Every 5th Wave):** Roll a specialized theme (such as _Swarm_, _Air Raid_, _Siege_, or _Tunnelers_) that heavily weights one archetype, avoiding back-to-back repeats.
- **Boss Waves (Every 10th Wave):** Feature a curated boss encounter from the map's boss pool, accompanied by support enemies.

Upcoming wave themes and active spawn zones are **telegraphed during the preparation phase** so players can adapt their walls, roster, and positioning.

### Unlock Gating and Probability Curves

- **Progressive Unlocking (`minWave`):** Early waves feature straightforward threats (Basic, Fast, and simple Ranged enemies). Trickier enemies that bypass or punish standard setups—such as **Flying, Burrowing/Tunneling, Armored, Structure Breakers, Disruptors, Teleporters, and Elites**—are gated until later waves, giving players time to recruit counters and build defenses.
- **Dynamic Weights:** Early-game enemies have high spawn probability in early waves and taper off later, while stronger, evolved, and elite threats ramp up as wave count increases.
- **Fairness Caps:** Disruptive enemy types are capped at a maximum share of any wave's strength budget so random rolls cannot create unfair spikes.

### Stat Scaling and Enemy Modifiers

- **Gentle Progressive Scaling:** Enemy HP and Attack scale smoothly on a modest per-wave curve so enemies keep pace with the player's upgrades and artifacts without turning into bullet sponges.
- **Enemy Trait Modifiers:** Starting in mid-to-late waves, enemies have a chance to spawn with **visible, readable trait modifiers** (marked by clear icons or auras), such as **Shielded** (starts with an absorptive barrier), **Enraged** (gains move/attack speed below 50% HP or when nearby allies faint), **Armored**, or **Swift**. Modifiers cost extra strength budget (e.g., `1.5×` base enemy strength), so modified threats naturally replace regular enemies rather than inflating total wave difficulty.

---

# 9. Roguelike Progression and Rewards

Each run should produce different team compositions and defensive builds.

## Random Rewards

Players receive rewards after selected waves or encounters.

Potential reward choices:

- Pokémon upgrades.
- Global artifacts.
- Held items.
- Recruitment opportunities.
- Pokédollars.
- Healing or revival items.
- Special consumables.

The player generally chooses from three randomized options.

## Pokémon Recruitment

Players can recruit additional Pokémon throughout a run. New recruits fill any open active slots (up to 6) and then expand the 6-slot reserve roster, allowing players to adapt their team for upcoming waves and bosses.

Potential recruitment methods:

- Choose one of three random Pokémon after an encounter.
- Complete special encounters.
- Defeat elite enemies or bosses.
- Spend resources at recruitment locations.

The active team remains limited to six Pokémon (12 total with reserves). If the full 12-Pokémon roster is already occupied, players can either replace a reserve Pokémon or take a fallback reward (such as Pokédollars or an upgrade).

## Pokémon Upgrades

Pokémon **do not have individual levels or XP**, ensuring reserve Pokémon are always combat-ready and never penalized when swapped into the active team. Instead, Pokémon grow stronger during a run through **branching specialization paths** and **class/branch upgrades**.

### Branching Specializations

Each Pokémon has **3 branching specialization options** (e.g., distinct combat styles or evolutions) to choose from during a run. Selecting a branch defines how that Pokémon's kit evolves for the rest of the run.

### Minor & Major Upgrades

After a Pokémon's branch is selected, subsequent upgrades come in two tiers:

- **Minor Upgrades (Class/Role-based):** Drawn from the Pokémon's class/role pool—such as attack, HP, defense, attack speed, attack range, or movement AP efficiency.
- **Major Upgrades (Branch-specific):** High-impact upgrades unique to the chosen branch—such as transforming passive abilities, adding chain/AoE/status effects to basic attacks, or expanding ultimate functionality and cooldowns.

Use a combination of predictable progression and occasional randomized choices.

---

# 10. Artifacts, Held Items, and Shop

Run-specific items are split into **global Artifacts**, **equippable Held Items**, and **consumables/supplies** bought from the out-of-combat shop.

## Artifacts (Global)

Artifacts are run-specific relics that **impact the game globally** (affecting the entire team, economy, battlefield structures, or movement rules) without needing to be equipped to an individual Pokémon.

Artifact categories:

1. Team-wide synergy artifacts.
2. Role-based or type-based artifacts.
3. Construction and defense artifacts.
4. Movement and action-point artifacts.
5. Economy and reward artifacts.

### Example Artifacts

- **Arcane Conduit:** Electric Pokémon gain attack speed when another Electric Pokémon is nearby.
- **Commander's Insignia:** Gain additional Pokédollars for each distinct Pokémon role on the team.
- **Temporal Gear:** Pokémon recover movement AP faster after defeating an enemy.
- **Fortification Core:** Walls gain additional durability.
- **Emergency Supplies:** Gain additional Pokédollars after surviving a wave without losing a wall.

## Held Items (Equippable)

**Held items** are equippable gear that enhance individual Pokémon. **Each Pokémon can equip up to 3 held items by default.**

- Held items can be swapped between Pokémon during the preparation phase.
- Some held items may be restricted to particular Pokémon or roles, and particularly powerful items may occupy multiple slots.
- Example held items: **Bloodthirsty Edge** (bonus damage to enemies below 50% HP), **Storm Conductor** (electric attacks chain to additional enemies), **Guardian Charm** (reduced damage taken near defensive structures).

## Preparation Shop (Out of Combat)

Between waves (when not in combat), players can access a **shop** using Pokédollars to purchase:

- **Revives** (e.g., Revive, Max Revive) to bring fainted Pokémon back into action.
- **Healing items** (e.g., Potions, Berries) to restore HP between waves.
- **Held items** and other tactical consumables or upgrades.

---

# 11. Resources and Economy

**Pokédollars** are the single unified currency for all construction, repairs, healing, revivals, and shop purchases (no separate construction materials). Pokédollars are intentionally limited so every preparation phase forces meaningful trade-offs.

## Pokédollars Uses

Pokédollars is spent on:

- Building walls.
- Building defensive structures.
- Repairing walls and structures.
- Upgrading fortifications.
- Healing Pokémon.
- Reviving fainted Pokémon.
- Other preparation-phase services.

The player must balance immediate survival with long-term investment.

For example:

- Repairing a damaged wall may prevent an enemy breakthrough.
- Placing a Field Healing Station or Explosive Barrel may sustain the frontline or clear a dangerous chokepoint.
- Reviving a fainted Pokémon may restore an important team role.
- Upgrading a wall may be more economical than repeatedly repairing a weak one.

## Pokédollars Sources

All income is **event-based** (never passive time ticks during a wave) to prevent stalling:

- **Defeating enemies:** Small per-kill bounties (higher for elites).
- **Completing waves:** Scaling wave-clear payout.
- **Anti-stall / clean-wave bonuses:** Optional bonus Pokédollars for taking no core damage or clearing under par time.
- **Surviving Resource Collectors:** Flat payout at wave end.
- **Optional objectives, special encounters, artifacts, and Pokémon abilities.**

Pokédollars income and costs should be balanced so that each wave roughly funds a meaningful choice (e.g., a few walls, or a structure plus a heal/repair) rather than letting players buy everything.

## Movement AP

Movement AP is a separate tactical resource. It is used to reposition Pokémon during combat and recovers via enemy kills and between waves. It should not be confused with Pokédollars.

---

# 12. Boss Encounters

Bosses should significantly change the battlefield and challenge the player's preparation.

Potential mechanics:

- Destroying walls and defensive structures.
- Summoning additional enemies.
- Creating hazardous terrain.
- Moving between different areas of the map.
- Attacking multiple objectives.
- Temporarily disabling Pokémon abilities.
- Changing movement and pathfinding rules.
- Creating pressure on multiple sides of the player's defenses.

Boss encounters should reward players who adapted their team and battlefield rather than simply accumulated the highest damage numbers.

---

# 13. Maps and Encounter Variety

Players can choose from **multiple selectable maps**, each with distinct layouts, tactical identities, and difficulty tiers. The goal is to avoid conventional tower-defense maps that consist of a fixed path and a few predetermined defensive positions.

## Map Difficulties and Game Modes

Maps are organized by **intrinsic difficulty** (e.g., Beginner, Intermediate, Advanced, Expert) based on factors like number of enemy spawn points, distance to the core, and buildable space. Each run takes place on **one chosen map** across **3 core difficulty tiers—20, 30, and 50 waves** (plus optional Endless or special rule-set modes such as restricted Pokémon types, reduced Pokédollars income, or no revivals, with a combat fast-forward speed toggle for longer runs).

Potential map mechanics:

| Map         | Unique Mechanics                                                |
| ----------- | --------------------------------------------------------------- |
| Forest      | Dense vegetation, multiple approaches, restricted visibility    |
| Cave        | Narrow passages, destructible rocks, limited construction space |
| Power Plant | Electrical hazards and interactive generators                   |
| Water Route | Water channels, aquatic movement, bridges                       |
| Ruins       | Ancient mechanisms, switches, movable barriers                  |

Different maps should encourage different defensive layouts and Pokémon compositions.

## Persistent Construction Across Waves

Because each run takes place on a **single chosen map**, all placed walls and persistent structures remain in place across every wave of the run (no multi-map carryover needed).

## Map Modifiers

Roguelike modifiers can change familiar encounters:

- Fog reduces visibility or attack range.
- Heavy rain changes elemental interactions.
- Nighttime introduces additional Ghost Pokémon.
- Overgrown vegetation blocks certain tiles.
- Enemy migration introduces additional spawn locations.

Map modifiers should change strategy rather than merely increase enemy stats.

---

# 14. Permanent Progression

Separate permanent progression from temporary run progression.

## Temporary Progression

Resets at the end of each run:

- Pokémon upgrades.
- Global artifacts.
- Held items.
- Run-specific bonuses.
- Construction improvements.
- Temporary recruited Pokémon.
- Run-specific resources.

## Permanent Progression

Persists across runs:

- Unlocking additional Pokémon (via Eggs and milestone captures).
- Earning **Mastery Points** for specific Pokémon.
- Unlocking **Shiny Pokémon** variants.
- Unlocking new maps, difficulties, and modes.
- Discovering new artifacts and held items.
- Unlocking challenge modifiers.
- Expanding available strategic options.

### Egg System and Pokémon Unlocks

- **Egg Hatching:** Clearing waves, bosses, and map modes rewards **Egg Vouchers**. Players spend vouchers on Eggs (tiered by rarity) that **hatch automatically after surviving a set number of waves** across runs.
- **Milestone / Capture Unlocks:** Defeating specific bosses or completing map difficulties can also directly unlock new Pokémon for the permanent starter pool.

### Mastery Points

Hatching duplicate Pokémon or using a species across runs grants **Mastery Points** for that Pokémon. Mastery Points unlock **modest, capped stat bonuses or small starting perks** (such as minor HP/Attack boosts or a starting utility bonus) rather than reducing starter draft costs, preserving the balance of the 10-point starter draft.

### Shiny Pokémon

Rare **Shiny** variants can be hatched from Eggs or encountered on rare occasions. Shinies display a distinct palette and subtle sparkle effect on the grid, and bringing Shiny Pokémon on the active team grants **team Luck** (slightly improving odds for rare upgrades, artifacts, and held items) rather than overwhelming raw combat power.

Permanent progression should primarily expand possibilities rather than provide overwhelming permanent combat power.

---

# 15. Challenge Modes

After completing the main progression, players can unlock customizable challenge modifiers.

Potential modifiers:

- Increased enemy HP.
- Increased enemy movement speed.
- Reduced Pokédollars income.
- Increased construction costs.
- Reduced AP recovery.
- Limited active Pokémon.
- Restricted Pokémon roles.
- No revivals.
- More enemy spawn locations.
- Additional boss abilities.
- Destructible or hazardous terrain.
- Increased wall damage taken.

These challenges should provide replayability without requiring entirely new maps.

---

# 16. Visual and Art Direction

## Art Style and Assets

Use **crisp modern pixel art** (e.g., `32×32` or `48×48` square-grid tiles with nearest-neighbor / integer scaling) so the battlefield stays detailed and sharp without looking overly chunky:

- **Battlefield Units:** Animated pixel-art Pokémon sprites (normal and Shiny variants), lazy-loaded per run/map to keep WebGL texture memory lean.
- **Projectiles & Combat VFX:** **PVFX Foundry** (CC0 pixel-art VFX spritesheets + JSON data) for elemental projectiles, impacts, and explosions, supplemented by Phaser particles/graphics for trails and chain effects.
- **Items & UI Icons:** Pixel item/berry icons (e.g., from **PokeAPI/sprites** or **PokéSprite**) for shop supplies, berries, and held items, paired with clean UI artwork for menus and collection screens.
- **Tilesets & Props:** Matching top-down pixel-art tilesets and props (trees, walls, water, caves, barrels) to be selected to match unit scale.

## Animation Approach

Instead of rigging 2D skeletons, use **pre-made directional pixel sprite sheets**:

- **Directional Sprite Sheets:** Use **PMDCollab/SpriteCollab** (`Walk-Anim`, `Idle-Anim`, `Attack-Anim`, `Hurt-Anim` + `AnimData.xml`) to drive 8-directional walking, idle, and attack animations directly in Phaser.
- **Procedural Fallback:** For any Pokémon or form lacking a complete sprite sheet, fall back to a static pixel sprite paired with lightweight Phaser tweens (walk hop, squash-and-stretch, hit flash, and attack lunge).

---

# 17. Prototype Scope

The initial prototype should validate whether open-map real-time tactical defense is fun.

## Prototype Content

- 1 open battlefield.
- 10 playable Pokémon.
- 4 enemy types.
- 1 defensive objective.
- Basic real-time enemy pathfinding.
- Wall construction between waves.
- Wall durability, destruction, and repair.
- A small set of defensive structures.
- Automatic basic attacks.
- Manual ability and ultimate activation.
- Tactical movement using AP.
- 3 reserve Pokémon slot or basic swapping system.
- Pokémon fainting and revival.
- Limited Pokédollars economy.
- 3–5 upgrades.
- 3–5 artifacts.
- 3 consecutive waves.

## Prototype Questions

1. Does enemy pathfinding around square-grid walls create interesting defensive decisions?
2. Can players understand and predict enemy routes?
3. Does two-ring real-time repositioning (1 AP / 2 AP) feel responsive?
4. Is the shared AP pool (10–12 AP, wave-end + kill-driven recovery) balanced without feeling too restrictive or too spammy?
5. Do wall construction, ruined-state repairs, and one-time consumables create meaningful trade-offs?
6. Can enemies counter excessive fortification without feeling unfair?
7. Is the Pokédollars economy restrictive in an enjoyable way?
8. Is managing six active Pokémon (with manual and auto-cast ultimates) comfortable during real-time combat?

---

# 18. Design Philosophy

The central experience should be about **building, adapting, and commanding a defense in real time**. The player is not simply placing Pokémon along an enemy path. They are constructing a battlefield, shaping enemy routes, commanding a team of Pokémon, and responding to enemies with different movement and combat abilities.

Walls and defensive structures provide persistent investments. Pokémon provide the active tactical power. Pokédollars forces the player to make difficult preparation decisions. Roguelike rewards and artifacts create different strategies across runs. Every wave should challenge the player's preparation. Every preparation phase should give the player meaningful ways to improve their chances of survival.

The most important design objective is to make the interaction between Pokémon abilities, movement, enemy behavior, construction, and resource management produce interesting tactical situations.
