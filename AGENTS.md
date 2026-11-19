# AGENTS.md

Guidelines for coding agents working in **PokéBastion TD**.

## Project Overview

- **Stack:** TypeScript (`strict: true`), Phaser 3, Vite, Vitest, ESLint 10, Prettier, Husky + `lint-staged`.
- **Entry points:** [src/main.ts](src/main.ts) (Phaser `896×576` `FIT` canvas + `HudOverlay`), [src/scenes/BootScene.ts](src/scenes/BootScene.ts), [src/scenes/BattleScene.ts](src/scenes/BattleScene.ts), [src/ui/HudOverlay.ts](src/ui/HudOverlay.ts).
- **Docs:** [README.md](README.md), [docs/architecture.md](docs/architecture.md), [docs/gdd.md](docs/gdd.md) (see Section 19 for current prototype status), [docs/agent-guidelines.md](docs/agent-guidelines.md) (UI/UX & Phaser polish standards).

## Required Verification Commands

Before finishing any code change or opening a PR, run:

```bash
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e   # Playwright browser smoke suite (when changing UI, Phaser scenes, or combat flow)
```

- Husky's `.husky/pre-commit` runs `npx lint-staged` (`eslint --fix` + `prettier --write`) on staged files.

## Testing Guidelines (3-Layer Pyramid)

When adding new Pokémon, items, artifacts, maps, or combat mechanics:

1. **Unit Tests (`tests/`, Vitest):**
   - Put all stat math, damage/effect formulas, pathfinding, economy, and save logic as pure functions in `src/engine/` (`combat.ts`, `rules.ts`, `pathfinding.ts`, `save.ts`) with zero Phaser/DOM imports.
   - Verify every new item, artifact, branch special, and unit/enemy formula with deterministic table-driven Vitest tests (e.g., `tests/combat.test.ts`, `tests/rules.test.ts`).
2. **Data & Manifest Integrity (`tests/dataIntegrity.test.ts`):**
   - Every new species, enemy, VFX, and audio key must pass `tests/dataIntegrity.test.ts` (valid manifests, finite positive stats, unique IDs, valid SFX/VFX mappings).
3. **E2E Smoke Tests (`e2e/`, Playwright):**
   - Do **not** write an E2E test per Pokémon or per item. Keep `e2e/game.spec.ts` focused on one smoke test per integration hook (boot/modals, draft/build/shop/inspector, wave combat → reward, 1 AP walk/defeat/restart/save) with `pageerror` and `console.error` guards.

## Architecture & Coding Conventions

1. **Keep `src/engine/` framework-free:**
   - `src/engine/pathfinding.ts` and `src/engine/rules.ts` must never import `phaser` or DOM APIs.
   - Implement new game math, pathfinding, economy, and reward rules as pure functions in `src/engine/` with Vitest unit tests in `tests/`.
2. **Preserve the HUD boundary:**
   - `HudOverlay` (`src/ui/HudOverlay.ts`) renders from `GameSnapshot` events emitted by `BattleScene` and triggers actions via public methods on `BattleScene`. Do not mutate simulation state from the UI layer.
3. **TypeScript & Lint rules:**
   - Avoid `any` (`@typescript-eslint/no-explicit-any` is an error) and unused locals/parameters (`noUnusedLocals`, `noUnusedParameters`, `no-useless-assignment`).
   - Match Prettier config: single quotes, semicolons, trailing commas (`.prettierrc`).
4. **Assets & Data Integrity:**
   - `public/assets/` and its `manifest.json` files are committed. Do not run `scripts/sync-assets.mjs` unless regenerating manifests from local asset packs.
   - Any species, VFX, or structure changes in `src/data/pokemon.ts` must pass `tests/dataIntegrity.test.ts` (`npm test`).
5. **UI/UX & Phaser Polish Standards:**
   - Follow [docs/agent-guidelines.md](docs/agent-guidelines.md) (synthesizing [`pbakaus/impeccable`](https://github.com/pbakaus/impeccable), [`pmarashian/cursor-agent-skills/phaser-gamedev`](https://github.com/pmarashian/cursor-agent-skills/tree/main/phaser-gamedev), and [`gamedev-skills/awesome-gamedev-agent-skills/game-ui-ux`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md)).
   - Keep `HudOverlay` strictly event-driven (`GameSnapshot`), keyboard/focus-accessible (`Escape` handling, `:focus-visible`, modal focus management), and visually verified via headless Playwright checks when changing UI.
   - Keep `BattleScene` movement/timers `delta`-based, respect Phaser `ScaleManager`, and avoid per-frame GC churn.
6. **Keep Docs in Sync:**
   - If you change gameplay rules, unit classes/costs, controls, or module structure, update [README.md](README.md), [docs/architecture.md](docs/architecture.md), and Section 19 of [docs/gdd.md](docs/gdd.md) in the same change.
