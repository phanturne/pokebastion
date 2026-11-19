# Agent Guidelines: UI/UX & Phaser Polish

Engineering and design standards for coding agents working on **PokéBastion TD**'s Phaser 3 game loop and DOM/CSS HUD.

---

## Sources & Citations

These guidelines adapt and synthesize best practices from:

1. **Impeccable** ([`pbakaus/impeccable`](https://github.com/pbakaus/impeccable)) — _Operate_-mode UI precision, visual craft floor (contrast, typography, spacing, elevation, interactive states, browser surfaces, purposeful motion), and polish-vs-redesign discipline.
2. **Phaser GameDev Skill** ([`pmarashian/cursor-agent-skills/tree/main/phaser-gamedev`](https://github.com/pmarashian/cursor-agent-skills/tree/main/phaser-gamedev)) — Phaser 3 Scale Manager usage, frame-rate independent `delta` movement, spritesheet dimension verification, scene lifecycle separation, and object-pooling/GC hygiene.
3. **Game UI/UX Skill** ([`gamedev-skills/awesome-gamedev-agent-skills` — `game-ui-ux`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md)) — Event-driven HUD updates, responsive anchored layouts, modal focus trapping and keyboard navigation, screen-stack discipline, and color-blind-safe accessibility.

---

## 1. Phaser 3 Game & Combat Polish (`phaser-gamedev`)

- **Scale Manager Only:** Viewport sizing must go through Phaser's `ScaleManager` (`src/main.ts` uses `Phaser.Scale.RESIZE` with `ResizeObserver` calling `game.scale.resize(...)`). Never apply manual CSS `transform: scale(...)` or mismatched canvas CSS widths/heights, which break pointer-to-world coordinate mapping.
- **Frame-Rate Independence:** All movement, projectile flight, cooldowns, status durations, and wave timers in `BattleScene` must scale by `delta / 1000` (and game speed multiplier), never frame counts.
- **Spritesheet & Asset Integrity:** Never guess frame dimensions. Verify against `public/assets/pokemon/manifest.json` and `public/assets/vfx/manifest.json` (`imageWidth = (frameWidth * cols) + (spacing * (cols - 1))`) and run `npm test` (`tests/dataIntegrity.test.ts`).
- **Scene & Engine Separation:** Keep `BootScene` for preloading/fallbacks, `BattleScene` for Phaser rendering/input/loop, and `src/engine/` completely framework-free for pure deterministic math and rules.
- **GC & Performance Hygiene:** Avoid allocating large arrays/objects per frame in `update()`. Reuse graphics/pools or bound active VFX/floating-text counts during heavy waves (verified by `tests/perf.test.ts` and `e2e/perf.spec.ts`).

---

## 2. Game UI/UX Architecture (`game-ui-ux`)

- **Event-Driven HUD:** `HudOverlay` (`src/ui/HudOverlay.ts`) must render strictly from `GameSnapshot` events emitted by `BattleScene` (plus initial snapshot on boot). Never poll `BattleScene` state via `requestAnimationFrame` or per-frame timers.
- **Anchored, Responsive Layout:** Avoid brittle pixel-locked assumptions. `#top-bar`, `#side-panel`, and `#modal-root` must remain readable and non-overlapping at `1280×800`, `1024×768`, and `1920×1080`, with safe-area awareness (`env(safe-area-inset-*)`) and scrollable overflow where content can grow.
- **Keyboard & Focus Discipline:**
  - Every modal and interactive control must be keyboard-accessible (`Tab`, `Enter`/`Space`, `Escape` to close/cancel).
  - Visible `:focus-visible` outlines on all buttons, tabs, and selectable cards.
  - When a modal opens, trap or move focus into it and restore focus cleanly when it closes; background controls must not steal `Escape` or focus while a modal is open.
- **Screen-Stack Clarity:** Keep modal precedence explicit (e.g., Credits / Pokédex / Map-Draft / Reward / Game Over) rather than ad-hoc overlapping flags.
- **Accessible Signaling:**
  - Never use color alone for state (pair HP/status/phase/affordability colors with text labels, icons, or badges).
  - Maintain ≥ 4.5:1 contrast for body/HUD text and ≥ 3:1 for large text and key indicators.

---

## 3. Visual Craft & Polish (`impeccable`)

- **Operate-Mode Precision:** PokéBastion TD's HUD is a tactical _Operate_ surface. Prioritize scanability, clear hierarchy, and fast decision-making over decorative chrome.
- **Typography & Tabular Numerals:**
  - Use `font-variant-numeric: tabular-nums` on all live counters (HP, Gold, AP, Wave, DPS, cooldowns, costs) to prevent horizontal jitter.
  - Keep label/value hierarchy crisp; avoid gratuitous eyebrow/kicker labels or redundant pill clutter.
- **Restrained Elevation:** Use one primary elevation cue per surface (crisp `1px` border or subtle shadow), avoiding heavy nested "cards inside cards" and noisy halos.
- **Complete Interactive States & Browser Surfaces:**
  - Every clickable element needs clear default, `:hover`, `:focus-visible`, `:active`, and `:disabled` states.
  - Style scrollbars, text selection, and focus rings to match the dark tactical palette (`src/styles.css`).
- **Purposeful Motion & Game Feel:**
  - Micro-animations (damage popups, hover previews, wave transitions, button feedback) should be crisp, interruptible, and honor `@media (prefers-reduced-motion: reduce)`.
- **Verify in a Real Browser:** Before finishing UI or scene polish, inspect rendered screenshots and run `npm run test:e2e` across representative states.
