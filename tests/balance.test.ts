import { describe, expect, it } from 'vitest';
import { MAP_CATALOG } from '../src/data/maps';
import { RUN_DIFFICULTIES } from '../src/data/waves';
import {
  computeSpeciesEfficiency,
  computeWaveCurveMetrics,
  formatBalanceReport,
  simulateRun,
} from '../src/engine/balanceSim';

describe('Static Balance & Economy Audits', () => {
  it('computes finite positive DPS/EHP and flags extreme cost-efficiency outliers', () => {
    const metrics = computeSpeciesEfficiency();
    expect(metrics.length).toBeGreaterThanOrEqual(150);

    const sortedDpsPerCost = [...metrics]
      .map((m) => m.dpsPerCost)
      .sort((a, b) => a - b);
    const medianDpsPerCost =
      sortedDpsPerCost[Math.floor(sortedDpsPerCost.length / 2)];

    expect(Number.isFinite(medianDpsPerCost)).toBe(true);
    expect(medianDpsPerCost).toBeGreaterThan(0);

    for (const m of metrics) {
      expect(Number.isFinite(m.dps)).toBe(true);
      expect(m.dps).toBeGreaterThan(0);
      expect(Number.isFinite(m.ehp)).toBe(true);
      expect(m.ehp).toBeGreaterThan(0);
      // Guardrail: no unit should be >5x or <0.1x median DPS/cost
      expect(m.dpsPerCost).toBeLessThan(medianDpsPerCost * 5);
      expect(m.dpsPerCost).toBeGreaterThan(medianDpsPerCost * 0.1);
    }
  });

  it('maintains smooth wave EHP curves and boss wave step-ups across maps and difficulties', () => {
    for (const map of MAP_CATALOG) {
      for (const diff of RUN_DIFFICULTIES) {
        const curve = computeWaveCurveMetrics(map.id, diff.id);
        expect(curve.length).toBe(diff.maxWaves);

        for (let i = 1; i < curve.length; i++) {
          const prev = curve[i - 1];
          const curr = curve[i];
          expect(curr.totalEnemyHp).toBeGreaterThan(0);
          expect(curr.totalBounty).toBeGreaterThan(0);

          if (curr.isBoss) {
            expect(curr.totalEnemyHp).toBeGreaterThanOrEqual(
              prev.totalEnemyHp * 0.7,
            );
          } else if (!prev.isBoss) {
            // Non-boss wave-over-wave EHP shouldn't spike >4x
            expect(curr.totalEnemyHp).toBeLessThan(prev.totalEnemyHp * 4);
          }
        }
      }
    }
  });
});

describe('Headless Simulation Balance Invariants', () => {
  it('produces identical results for the same seed', () => {
    const runA = simulateRun({
      mapId: 'viridian_outpost',
      difficulty: 'normal',
      strategy: 'balanced',
      seed: 42,
      maxWavesToSim: 10,
    });
    const runB = simulateRun({
      mapId: 'viridian_outpost',
      difficulty: 'normal',
      strategy: 'balanced',
      seed: 42,
      maxWavesToSim: 10,
    });
    expect(runA).toEqual(runB);
  });

  it('engages enemies, deals damage, and earns bounty across bot personas', () => {
    for (const strategy of ['balanced', 'greedy', 'random'] as const) {
      const res = simulateRun({
        mapId: 'viridian_outpost',
        difficulty: 'easy',
        strategy,
        seed: 7,
        maxWavesToSim: 10,
      });
      expect(res.totalKills).toBeGreaterThan(0);
      expect(res.totalGoldEarned).toBeGreaterThan(0);
      expect(res.waveReached).toBeGreaterThanOrEqual(
        strategy === 'balanced' ? 2 : 1,
      );
      expect(Object.keys(res.damageBySpecies).length).toBeGreaterThan(0);
    }
  });

  it('enforces difficulty scaling (easy reaches at least as far as expert)', () => {
    const easy = simulateRun({
      mapId: 'viridian_outpost',
      difficulty: 'easy',
      strategy: 'balanced',
      seed: 101,
    });
    const expert = simulateRun({
      mapId: 'viridian_outpost',
      difficulty: 'expert',
      strategy: 'balanced',
      seed: 101,
    });
    expect(easy.waveReached).toBeGreaterThanOrEqual(
      Math.min(expert.waveReached, easy.maxWaves),
    );
  });

  if (process.env.BALANCE_REPORT === '1') {
    it('prints balance report', () => {
      console.log('\n' + formatBalanceReport() + '\n');
    }, 120_000);
  }
});
