# PokéBastion TD — Architecture Overview

## Layered Structure

```
src/
├── types.ts                 # Shared domain types, grid constants (18×12 @ 48px)
├── data/
│   └── pokemon.ts           # Pure data tables: 10 Pokémon, 4 enemies, structures, rewards, waves
├── engine/                  # Pure TypeScript simulation & rules (100% unit-testable, zero Phaser deps)
│   ├── pathfinding.ts       # 4-dir A* (ground, burrow, fly), nearest-wall fallback, no-build rules
│   └── rules.ts             # AP movement rings, stat/artifact/upgrade math, economy, reward generation
├── scenes/                  # Phaser 3 rendering, input & real-time loop
│   ├── BootScene.ts         # Loads MPWSP01 tileset, PVFX manifests, PMDCollab sheets + procedural fallbacks
│   └── BattleScene.ts       # Battlefield rendering, live A* previews, combat loop, VFX & HUD snapshots
├── ui/
│   └── HudOverlay.ts        # DOM/CSS HUD subscribing to Phaser 'snapshot' events
└── main.ts                  # Phaser.Scale.FIT responsive full-viewport bootstrap
```

## Scaling Guidelines (GDD Expansion)

1. **Keep `src/engine/` framework-free:** All new mechanics (6 classes / 18 subclasses, branching evolutions, held items, wave budget generator, map modifiers) should be implemented as pure functions in `src/engine/` with Vitest coverage before wiring visuals in `BattleScene.ts`.
2. **Extract `BattleScene` subsystems as they grow:** Currently `BattleScene.ts` handles rendering, combat AI, and wave spawning. When adding bosses or multi-map support, split into `CombatSystem`, `WaveDirector`, and `GridRenderer` classes that operate on a shared `RunState` object.
3. **Data-driven assets:** `scripts/sync-assets.mjs` generates `public/assets/vfx/manifest.json` and `public/assets/pokemon/manifest.json`. `tests/dataIntegrity.test.ts` verifies that every species/VFX reference in `src/data/pokemon.ts` resolves to a real manifest entry.
4. **Full-viewport responsive scaling:** `Phaser.Scale.FIT` + `autoCenter: Phaser.Scale.CENTER_BOTH` scales the crisp `864×576` (`pixelArt: true`) grid to fill any browser window while keeping exact grid-cell pointer coordinates.
