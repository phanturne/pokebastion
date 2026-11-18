# PokéBastion TD

An open-map, real-time roguelike tower defense prototype built with **Phaser 3**, **TypeScript**, and **Vite**, inspired by _The Last Spell_, _Arknights_, and _Path to Nowhere_.

Instead of fixed enemy lanes, enemies pathfind dynamically across a `28×18` grid toward your central Pokémon Center. Build walls to shape chokepoints, draft your team with a 10-point budget, pick 3-way specializations, equip held items, and trigger manual or auto-cast ultimates across a 10-wave run.

---

## Live Demo

Play the latest `master` build on GitHub Pages: **https://phanturne.github.io/pokebastion/**

## Quick Start

**Prerequisites:** Node.js 22+ (matches CI) and npm.

```bash
npm install
npm run dev       # Start Vite dev server (http://localhost:5173)
```

> **Note:** `husky` + `lint-staged` is configured via `prepare` and automatically runs ESLint and Prettier on staged files when you commit.

### Scripts

| Command                | Description                                               |
| :--------------------- | :-------------------------------------------------------- |
| `npm run dev`          | Start local development server                            |
| `npm run build`        | Type-check (`tsc`) and build production bundle to `dist/` |
| `npm run preview`      | Preview production `dist/` build locally                  |
| `npm test`             | Run Vitest unit & data-integrity tests                    |
| `npm run test:watch`   | Run Vitest in watch mode                                  |
| `npm run lint`         | Run ESLint across the repository                          |
| `npm run format`       | Format files with Prettier                                |
| `npm run format:check` | Check Prettier formatting without modifying files         |

---

## Current Prototype Scope

- **Battlefield:** `28×18` square grid (`32px` tiles, `896×576` logical canvas) with a `2×2` central Pokémon Center (`1000 HP`), randomized wave spawn portals, and live 8-directional A* path previews.
- **Playable Pokémon (10):**
  - _10-Point Starter Draft:_ Draft 1–6 starting Pokémon before Wave 1 (`Squirtle`, `Charmander`, and `Bulbasaur` are unlocked for everyone at `3 pts` each; others cost `2–4 pts`).
  - _3-Way Branching Specializations:_ Every Pokémon has 3 distinct specialization/evolution branches, unlocked via post-wave **Specialization** reward choices.
  - _Held Items (3 Slots):_ Purchase and equip `Bloodthirsty Edge`, `Storm Conductor`, and `Guardian Charm` during `PREP` via the unit popover.
- **Enemy Types (10):** Rattata, Raticate, Diglett (`burrow`), Dugtrio (`burrow`), Zubat (`fly`), Golbat (`fly`), Crobat (`fly`), Geodude (wall-breaker), Graveler (heavy wall-breaker), and Golem (siege juggernaut).
- **Structures (4):** Wood Wall (`₽20`), Stone Wall (`₽50`), Berry Bush (`₽70`, heals nearby units), Explosive Barrel (`₽30`, consumable AoE blast).
- **Progression:** 10 consecutive waves with post-wave roguelike drafts (recruit Pokémon, team upgrades, and global artifacts).

---

## Controls & Gameplay Loop

1. **Preparation Phase (`PREP`):**
   - Place, move, repair, or sell (70% refund) structures on valid grass/dirt tiles (the outer 2-tile border and active portal buffers are no-build zones).
   - Reposition Pokémon freely (`0 AP`), heal (`₽15`), revive (`₽35`), deploy reserves (up to `6` active), or swap with reserves.
   - Watch live dashed enemy path previews update as you place or hover walls.
   - Click **Start Wave** when ready.
2. **Combat Phase (`COMBAT`):**
   - Pokémon auto-attack enemies in range.
   - Click a Pokémon, then click a highlighted tile to reposition using shared **AP** (`1 AP` within standard `moveRange`, `2 AP` within `2× moveRange`; `+3 AP` per wave, `+1 AP` every 6 kills).
   - Trigger ultimates manually (or toggle auto-ult per unit) and switch between `1×` / `2×` simulation speed.
3. **Reward Phase (`REWARD`):**
   - Pick 1 of 3 randomized rewards (recruit a new Pokémon, team upgrade, or global artifact) before the next wave's prep phase.
4. **Shortcuts:**
   - **Right-click** on the canvas or press **`Esc`** to cancel active tool placement, unit selection, or ultimate aiming (`Esc` also closes the Credits modal). No other keyboard hotkeys are bound yet.

---

## Project Layout

- `src/types.ts`, `src/main.ts` — Shared domain types, grid constants, and Phaser bootstrap
- `src/engine/` — Framework-free simulation rules (`pathfinding.ts`, `rules.ts`)
- `src/data/` — Species, structure, reward, and wave definitions (`pokemon.ts`)
- `src/scenes/` — Phaser 3 asset loading (`BootScene.ts`) and battlefield loop (`BattleScene.ts`)
- `src/ui/` — DOM/CSS HUD overlay (`HudOverlay.ts`)
- `public/assets/` — Committed spritesheets, tilesets, props, and generated asset manifests
- `scripts/` — Asset manifest sync helper (`sync-assets.mjs`)
- `tests/` — Vitest suites (`pathfinding.test.ts`, `rules.test.ts`, `dataIntegrity.test.ts`)
- `docs/` — [Game Design Document](docs/gdd.md) & [Architecture Overview](docs/architecture.md)

---

## Credits & Docs

- Full design vision & prototype status: [docs/gdd.md](docs/gdd.md)
- Technical architecture: [docs/architecture.md](docs/architecture.md)
- Asset & sprite credits: [CREDITS.md](CREDITS.md)
