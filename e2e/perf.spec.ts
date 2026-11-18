import { expect, test } from '@playwright/test';

test.describe('PokéBastion TD — Performance & Memory Budgets', () => {
  test('maintains bounded JS heap across run restarts and bounded DOM/frame behavior in combat', async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');

    await page.goto('/');

    const runOneCycleAndRestart = async () => {
      await page.locator('[data-action="home-play"]').click();
      await page
        .locator('[data-action="select-map"][data-id="viridian_outpost"]')
        .click();
      await page.locator('[data-action="confirm-draft"]').click();
      await expect(page.locator('#top-bar')).toContainText('PREP');

      await page.locator('[data-action="toggle-mute"]').click();
      await page.locator('[data-action="toggle-speed"]').click();
      await page.locator('[data-action="start-wave"]').click();
      await expect(page.locator('#top-bar')).toContainText('COMBAT');

      // Sample rAF frame deltas & DOM node count during 2s of combat
      const metrics = await page.evaluate(
        () =>
          new Promise<{ maxFrameDeltaMs: number; domNodes: number }>(
            (resolve) => {
              let last = performance.now();
              let maxDelta = 0;
              const start = last;
              const step = (now: number) => {
                maxDelta = Math.max(maxDelta, now - last);
                last = now;
                if (now - start >= 1500) {
                  resolve({
                    maxFrameDeltaMs: maxDelta,
                    domNodes: document.querySelectorAll('*').length,
                  });
                } else {
                  requestAnimationFrame(step);
                }
              };
              requestAnimationFrame(step);
            },
          ),
      );

      expect(metrics.domNodes).toBeLessThan(1500);
      expect(metrics.maxFrameDeltaMs).toBeLessThan(500);

      // Return to Home via top bar
      await page.locator('[data-action="back-home"]').click();
      await expect(page.locator('[data-action="home-play"]')).toBeVisible();
    };

    // Warmup cycle 1
    await runOneCycleAndRestart();
    await cdp.send('HeapProfiler.collectGarbage');
    const heapAfterCycle1 = (await cdp.send('Runtime.getHeapUsage')).usedSize;

    // Cycle 2
    await runOneCycleAndRestart();
    await cdp.send('HeapProfiler.collectGarbage');
    const heapAfterCycle2 = (await cdp.send('Runtime.getHeapUsage')).usedSize;

    const heapGrowthMb = (heapAfterCycle2 - heapAfterCycle1) / (1024 * 1024);
    expect(heapGrowthMb).toBeLessThan(15);
  });
});
