import type { RunDifficulty } from '../types';
import { MAP_BY_ID, type MapWaveTheme } from './maps';
import {
  ENEMY_SPECIES,
  WAVE_DEFINITIONS,
  type WaveDefinition,
  type WaveSpawnGroup,
} from './pokemon';

export type { WaveDefinition, WaveSpawnGroup };

export interface RunDifficultySpec {
  id: RunDifficulty;
  name: string;
  badge: string;
  subtitle: string;
  maxWaves: number;
  coreMaxHp: number;
  startingGold: number;
  bountyMult: number;
  enemyHpMult: number;
  enemyAtkMult: number;
  enemySpeedMult: number;
}

/**
 * Run difficulty presets scaled to tactical grid TD pacing (Easy 20, Normal 30,
 * Hard 40, Expert 50) with boss waves every 10 waves and shops every 5 waves.
 */
export const RUN_DIFFICULTIES: readonly RunDifficultySpec[] = [
  {
    id: 'easy',
    name: 'Easy',
    badge: 'Beginner Friendly',
    subtitle: '20-wave run (2 boss waves) with extra Core HP and higher gold.',
    maxWaves: 20,
    coreMaxHp: 1200,
    startingGold: 170,
    bountyMult: 1.15,
    enemyHpMult: 0.85,
    enemyAtkMult: 0.85,
    enemySpeedMult: 0.95,
  },
  {
    id: 'normal',
    name: 'Normal',
    badge: 'Standard',
    subtitle: '30-wave Bastion defense (3 boss waves) with baseline stats.',
    maxWaves: 30,
    coreMaxHp: 1000,
    startingGold: 140,
    bountyMult: 1.0,
    enemyHpMult: 1.0,
    enemyAtkMult: 1.0,
    enemySpeedMult: 1.0,
  },
  {
    id: 'hard',
    name: 'Hard',
    badge: 'Challenging',
    subtitle: '40-wave siege (4 boss waves) with tougher foes & tighter gold.',
    maxWaves: 40,
    coreMaxHp: 750,
    startingGold: 120,
    bountyMult: 0.85,
    enemyHpMult: 1.25,
    enemyAtkMult: 1.2,
    enemySpeedMult: 1.08,
  },
  {
    id: 'expert',
    name: 'Expert',
    badge: 'Impoppable',
    subtitle:
      '50-wave gauntlet (5 boss waves): half Core HP, scarce gold, elite speed.',
    maxWaves: 50,
    coreMaxHp: 500,
    startingGold: 100,
    bountyMult: 0.75,
    enemyHpMult: 1.5,
    enemyAtkMult: 1.4,
    enemySpeedMult: 1.15,
  },
];

export const RUN_DIFFICULTY_BY_ID: Record<RunDifficulty, RunDifficultySpec> =
  Object.fromEntries(RUN_DIFFICULTIES.map((d) => [d.id, d])) as Record<
    RunDifficulty,
    RunDifficultySpec
  >;

const DEFAULT_THEME: MapWaveTheme = {
  label: 'Balanced Frontier',
  early: ['0019', '0074', '0050', '0041'],
  mid: ['0020', '0081', '0092', '0042', '0051'],
  late: ['0075', '0082', '0169', '0051'],
  boss: ['0076', '0169', '0082'],
};

function buildThemedWave(
  waveNum: number,
  maxWaves: number,
  theme: MapWaveTheme,
): WaveDefinition {
  const progress = waveNum / Math.max(1, maxWaves);
  const isBossWave = waveNum % 10 === 0 || waveNum === maxWaves;
  const intervalBase = Math.max(600, 1450 - waveNum * 18);

  const chosenIds: string[] = [];
  const isAllowedAtWave = (id: string): boolean => {
    const mt = ENEMY_SPECIES[id]?.movementType;
    if (!mt) return false;
    if (waveNum <= 3) return mt === 'ground';
    if (waveNum <= 7) return mt !== 'fly';
    return true;
  };
  const pushUnique = (id: string) => {
    if (!chosenIds.includes(id) && isAllowedAtWave(id)) {
      chosenIds.push(id);
    }
  };

  if (isBossWave) {
    for (const b of theme.boss) pushUnique(b);
    pushUnique(theme.late[waveNum % theme.late.length]);
    pushUnique(theme.mid[waveNum % theme.mid.length]);
  } else if (waveNum <= 3) {
    for (const id of theme.early) pushUnique(id);
    if (chosenIds.length === 0) {
      pushUnique('0019');
      pushUnique('0074');
    }
  } else if (waveNum <= 7) {
    for (const id of theme.early) pushUnique(id);
    pushUnique(theme.mid[waveNum % theme.mid.length]);
    if (waveNum >= 6) {
      pushUnique(theme.late[waveNum % theme.late.length]);
    }
    if (chosenIds.length === 0) {
      pushUnique('0020');
      pushUnique('0051');
    }
  } else if (progress <= 0.25) {
    pushUnique(theme.early[waveNum % theme.early.length]);
    pushUnique(theme.early[(waveNum + 1) % theme.early.length]);
    pushUnique(theme.early[(waveNum + 2) % theme.early.length]);
  } else if (progress <= 0.6) {
    pushUnique(theme.mid[waveNum % theme.mid.length]);
    pushUnique(theme.early[waveNum % theme.early.length]);
    pushUnique(theme.mid[(waveNum + 2) % theme.mid.length]);
    if (waveNum % 5 === 0) {
      pushUnique(theme.late[waveNum % theme.late.length]);
    }
  } else {
    pushUnique(theme.late[waveNum % theme.late.length]);
    pushUnique(theme.mid[waveNum % theme.mid.length]);
    pushUnique(theme.late[(waveNum + 1) % theme.late.length]);
    if (progress > 0.8) {
      pushUnique(theme.boss[waveNum % theme.boss.length]);
    }
  }

  const spawns: WaveSpawnGroup[] = chosenIds.map((speciesId, idx) => {
    const isBossSpecies = theme.boss.includes(speciesId);
    const baseCount = isBossSpecies
      ? Math.max(2, Math.floor(1 + waveNum * 0.16))
      : Math.max(3, Math.floor(4 + waveNum * 0.45) - idx * 2);
    return {
      speciesId,
      count: Math.max(2, baseCount),
      side: 'both',
      intervalMs: isBossSpecies
        ? Math.max(1400, intervalBase + 900)
        : Math.max(650, intervalBase + idx * 220),
      delayMs: idx * 900,
    };
  });

  const bossIdx = Math.max(0, Math.floor(waveNum / 10) - 1) % theme.boss.length;
  const flagshipBossId = theme.boss[bossIdx];
  if (isBossWave && flagshipBossId && ENEMY_SPECIES[flagshipBossId]) {
    spawns.unshift({
      speciesId: flagshipBossId,
      count: 1,
      side: 'both',
      intervalMs: 1500,
      delayMs: 1500,
      isBoss: true,
    });
  }

  const leadName = ENEMY_SPECIES[chosenIds[0]]?.name ?? 'Frontier';
  const title =
    waveNum === maxWaves
      ? `Wave ${waveNum}: ${theme.label} Finale`
      : isBossWave
        ? `Wave ${waveNum}: ${leadName} Siege`
        : `Wave ${waveNum}: ${leadName} Assault`;
  const names = chosenIds.map((id) => ENEMY_SPECIES[id]?.name ?? id).join(', ');

  return {
    wave: waveNum,
    title,
    desc: `${theme.label} wave featuring ${names}.`,
    spawns,
  };
}

/**
 * Optional per-map wave overrides so future maps can customize specific
 * difficulties while falling back to their `waveTheme` progression.
 */
export const MAP_WAVE_OVERRIDES: Partial<
  Record<string, Partial<Record<RunDifficulty, WaveDefinition[]>>>
> = {};

export function getWavesForRun(
  mapId: string,
  difficulty: RunDifficulty,
): WaveDefinition[] {
  const override = MAP_WAVE_OVERRIDES[mapId]?.[difficulty];
  if (override && override.length > 0) {
    return override;
  }

  const maxWaves = RUN_DIFFICULTY_BY_ID[difficulty].maxWaves;
  const theme = MAP_BY_ID[mapId]?.waveTheme ?? DEFAULT_THEME;
  const waves: WaveDefinition[] = [];

  for (let w = 1; w <= maxWaves; w++) {
    if (mapId === 'viridian_outpost' && w <= WAVE_DEFINITIONS.length) {
      const base = WAVE_DEFINITIONS[w - 1];
      if (w === 10) {
        waves.push({
          ...base,
          spawns: [
            {
              speciesId: '0076',
              count: 1,
              side: 'both',
              intervalMs: 1500,
              delayMs: 1500,
              isBoss: true,
            },
            ...base.spawns,
          ],
        });
      } else {
        waves.push(base);
      }
    } else {
      waves.push(buildThemedWave(w, maxWaves, theme));
    }
  }

  return waves;
}
