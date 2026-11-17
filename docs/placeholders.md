# Placeholders & Procedural Fallbacks

All core tiles, Pokémon sprites, and combat VFX use the real requested asset packs (MPWSP01, PMDCollab SpriteCollab, and PVFX Foundry). The following items use lightweight procedural pixel-art graphics generated at boot in `BootScene.ts` and are noted here for future replacement:

1. **Bastion Core (`2×2` Objective):** Procedural glowing cyan/gold crystal bastion sprite (`96×96` px) instead of a custom multi-tile sprite.
2. **Buildable Structures & States:**
   - **Wooden Barricade** & **Stone Wall**: Uses MPWSP01 bush/boulder tiles where available, supplemented by procedural pixel framing & HP/ruined rubble overlay.
   - **Berry Bush (Field Healing Station)**: Uses MPWSP01 bush tile with procedural red/pink berry accents.
   - **Explosive Barrel**: Procedural pixel-art red/amber barrel icon (`48×48` px).
   - **Ruined State Overlay**: Procedural cracked-rubble pixel graphic (`48×48` px).
3. **PMD Sprite Fallback:** If any PMDCollab spritesheet fails to load or is offline, `BattleScene` automatically falls back to a procedural colored pixel circle with species initials and tween hop/lunge animations.
4. **Audio / SFX:** No audio files are included in the prototype; combat feedback is purely visual (PVFX spritesheets, floating damage numbers, hit flashes).
