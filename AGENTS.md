# AGENTS.md

Guidelines for coding agents working in **PokéBastion TD**.

## Project Overview

- **Stack:** TypeScript (`strict: true`), Phaser 3, Vite, Vitest, ESLint 10, Prettier, Husky + `lint-staged`.
- **Entry points:** [src/main.ts](src/main.ts) (Phaser `896×576` `FIT` canvas + `HudOverlay`), [src/scenes/BootScene.ts](src/scenes/BootScene.ts), [src/scenes/BattleScene.ts](src/scenes/BattleScene.ts), [src/ui/HudOverlay.ts](src/ui/HudOverlay.ts).
- **Docs:** [README.md](README.md), [docs/architecture.md](docs/architecture.md), [docs/gdd.md](docs/gdd.md) (see Section 19 for current prototype status).

## Required Verification Commands

Before finishing any code change or opening a PR, run:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

- Husky's `.husky/pre-commit` runs `npx lint-staged` (`eslint --fix` + `prettier --write`) on staged files.

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
5. **Keep Docs in Sync:**
   - If you change gameplay rules, unit classes/costs, controls, or module structure, update [README.md](README.md), [docs/architecture.md](docs/architecture.md), and Section 19 of [docs/gdd.md](docs/gdd.md) in the same change.
