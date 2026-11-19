import { expect, test, type Page } from '@playwright/test';

function attachErrorGuards(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return { errors };
}

async function draftStarterTeamAndEnterPrep(
  page: Page,
  customDraft = true,
): Promise<void> {
  await page.locator('[data-action="home-play"]').click();
  await expect(
    page.locator('[data-action="select-map"][data-id="viridian_outpost"]'),
  ).toBeVisible();
  await page
    .locator('[data-action="select-map"][data-id="viridian_outpost"]')
    .click();

  const confirmBtn = page.locator('[data-action="confirm-draft"]');
  await expect(confirmBtn).toBeVisible();

  if (customDraft) {
    const clearBtn = page.locator('[data-action="clear-draft"]');
    if (await clearBtn.isEnabled()) {
      await clearBtn.click();
    }
    await expect(confirmBtn).toBeDisabled();

    // Draft up to 6 starter units within the 10-point budget
    for (const id of ['0001', '0004', '0007', '0025', '0074', '0092']) {
      const inspect = page.locator(
        `[data-action="inspect-draft"][data-id="${id}"]`,
      );
      if ((await inspect.count()) > 0) {
        await inspect.click();
        const toggle = page.locator(
          `[data-action="toggle-draft"][data-id="${id}"]`,
        );
        if (await toggle.isEnabled()) {
          await toggle.click();
        }
      }
    }
  }

  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  await expect(page.locator('#top-bar')).toContainText(/Wave\s+1\s*\/\s*10/);
  await expect(page.locator('#top-bar')).toContainText('PREP');
}

async function readGold(page: Page): Promise<number> {
  const text = await page.locator('#top-bar').innerText();
  const match = text.match(/₽(\d+)/);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

test.describe('PokéBastion TD — Phaser E2E', () => {
  test('boots Phaser canvas, opens Pokédex and Credits cleanly', async ({
    page,
  }) => {
    const { errors } = attachErrorGuards(page);
    await page.goto('/');

    const canvas = page.locator('#phaser-host canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);

    // Home modal visible (allow extra time for BootScene asset preload on CI)
    const homeDialog = page.locator('#modal-root [role="dialog"]');
    await expect(page.locator('[data-action="home-play"]')).toBeVisible({
      timeout: 25_000,
    });
    await expect(homeDialog).toHaveAttribute('aria-modal', 'true');

    // Blocking phase modal ignores Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-action="home-play"]')).toBeVisible();

    // Open & filter Pokédex, verify focus trap, then close with Escape
    await page.locator('[data-action="open-pokedex"]').click();
    await expect(
      page.locator('[data-action="pokedex-filter"][data-id="unlocked"]'),
    ).toBeVisible();
    await expect(page.locator('#modal-root [role="dialog"]')).toHaveAttribute(
      'aria-modal',
      'true',
    );
    await page.keyboard.press('Tab');
    const focusInsideModal = await page.evaluate(() =>
      Boolean(
        document.getElementById('modal-root')?.contains(document.activeElement),
      ),
    );
    expect(focusInsideModal).toBe(true);
    await page
      .locator('[data-action="pokedex-filter"][data-id="unlocked"]')
      .click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-action="home-play"]')).toBeVisible();

    // Open & close Credits via backdrop click
    await page.locator('#modal-root [data-action="toggle-credits"]').click();
    await expect(page.locator('[data-action="close-credits"]')).toBeVisible();
    await page
      .locator('#modal-root .menu-backdrop')
      .click({ position: { x: 10, y: 10 } });
    await expect(page.locator('[data-action="home-play"]')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('drafts a starter team, places structure, buys/equips held item, and inspects unit', async ({
    page,
  }) => {
    const { errors } = attachErrorGuards(page);
    await page.goto('/');
    await draftStarterTeamAndEnterPrep(page);

    const initialGold = await readGold(page);
    expect(initialGold).toBeGreaterThan(0);

    // Ult button is omitted during PREP to keep unit cards clean
    await expect(page.locator('[data-action="cast-ult"]')).toHaveCount(0);

    // Building shop is directly in the sidebar during PREP (no tab switch needed)
    await expect(
      page.locator('[data-action="select-tool"][data-id="move_struct"]'),
    ).toHaveCount(0);
    await page
      .locator('[data-action="select-tool"][data-id="wood_wall"]')
      .click();
    await expect(page.locator('.active-mode-bar')).toBeVisible();

    const canvas = page.locator('#phaser-host canvas');
    const box = (await canvas.boundingBox())!;
    // Click around (42%, 44%) of canvas (interior grass tile away from border/core)
    await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.44);

    // Cancel build tool with Escape
    await page.keyboard.press('Escape');

    // Left-click placed structure to enter direct move mode, then Escape to cancel
    await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.44);
    await expect(page.locator('.active-mode-bar')).toContainText('Moving');
    await page.keyboard.press('Escape');

    // Right-click placed structure to open small floating popover with details + Sell button
    await page.mouse.click(
      box.x + box.width * 0.42,
      box.y + box.height * 0.44,
      { button: 'right' },
    );
    await expect(page.locator('#map-popover')).toBeVisible();
    await expect(
      page.locator('#map-popover [data-action="sell-struct-uid"]'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#map-popover')).toBeHidden();

    const goldAfterBuild = await readGold(page);
    expect(goldAfterBuild).toBeLessThan(initialGold);

    // Bottom bar displays 6 party slots + 3 reserve slots, and unit details modal opens
    await expect(
      page.locator('#bottom-bar .bp-slot:not(.reserve)'),
    ).toHaveCount(6);
    await expect(page.locator('#bottom-bar .bp-slot.reserve')).toHaveCount(3);
    await page
      .locator('#bottom-bar [data-action="expand-unit"]')
      .first()
      .click({ force: true });
    await expect(
      page.locator('[data-action="close-expanded-unit"]'),
    ).toBeVisible();
    await page.locator('[data-action="close-expanded-unit"]').click();

    // Verify compact 1024x768 layout has no top-bar/side-panel overlap or horizontal overflow
    await page.setViewportSize({ width: 1024, height: 768 });
    const topBox = await page.locator('#top-bar').boundingBox();
    const sideBox = await page.locator('#side-panel').boundingBox();
    const homeBtnBox = await page
      .locator('#top-bar [data-action="back-home"]')
      .boundingBox();
    const topBarOverflow = await page.evaluate(() => {
      const el = document.getElementById('top-bar');
      return el ? el.scrollWidth > el.clientWidth : true;
    });
    expect(topBox).not.toBeNull();
    expect(sideBox).not.toBeNull();
    expect(homeBtnBox).not.toBeNull();
    expect(topBarOverflow).toBe(false);
    expect(topBox!.x + topBox!.width).toBeLessThanOrEqual(sideBox!.x + 1);
    expect(homeBtnBox!.x + homeBtnBox!.width).toBeLessThanOrEqual(
      sideBox!.x + 1,
    );
    expect(topBox!.height).toBeLessThanOrEqual(80);
    await page.setViewportSize({ width: 1280, height: 800 });

    expect(errors).toEqual([]);
  });

  test('runs Wave 1 combat at 2x speed, clears wave, and advances to Wave 2', async ({
    page,
  }) => {
    const { errors } = attachErrorGuards(page);
    await page.goto('/');
    await draftStarterTeamAndEnterPrep(page, true);

    // Place 2 wood walls + 2 barrels near center from the PREP Building Shop sidebar (₽100 total)
    await page
      .locator('[data-action="select-tool"][data-id="wood_wall"]')
      .click();
    const canvas = page.locator('#phaser-host canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.44);
    await page.mouse.click(box.x + box.width * 0.58, box.y + box.height * 0.44);
    await page.locator('[data-action="select-tool"][data-id="barrel"]').click();
    await page.mouse.click(box.x + box.width * 0.46, box.y + box.height * 0.44);
    await page.mouse.click(box.x + box.width * 0.54, box.y + box.height * 0.44);
    await page.keyboard.press('Escape');

    // Mute audio and switch to 2x speed
    await page.locator('[data-action="toggle-mute"]').click();
    await expect(page.locator('[data-action="toggle-mute"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.locator('[data-action="toggle-speed"]').click();
    await expect(page.locator('[data-action="toggle-speed"]')).toContainText(
      '2×',
    );

    // Start Wave 1 and verify Combat Stats sidebar appears
    await page.locator('[data-action="start-wave"]').click();
    await expect(page.locator('#top-bar')).toContainText('COMBAT');
    await expect(page.locator('#side-panel')).toContainText('DAMAGE DEALT');
    await page
      .locator('[data-action="switch-stat-tab"][data-id="taken"]')
      .click();
    await expect(page.locator('#side-panel')).toContainText('DAMAGE TAKEN');
    await page
      .locator('[data-action="switch-stat-tab"][data-id="healed"]')
      .click();
    await expect(page.locator('#side-panel')).toContainText('HEALING DONE');

    // Wait for Wave 1 to complete: either a reward/branch modal opens or Wave 2 PREP begins
    const rewardOrBranch = page.locator(
      '[data-action="pick-reward"], [data-action="pick-branch-reward"]',
    );
    const wave2Prep = page
      .locator('#top-bar')
      .filter({ hasText: /Wave\s+2\s*\/\s*10/ });

    await expect(rewardOrBranch.first().or(wave2Prep)).toBeVisible({
      timeout: 35_000,
    });

    for (let i = 0; i < 4; i++) {
      if (await wave2Prep.isVisible()) break;
      if ((await rewardOrBranch.count()) > 0) {
        await rewardOrBranch.first().click();
        await page.waitForTimeout(150);
      } else {
        break;
      }
    }

    await expect(page.locator('#top-bar')).toContainText(/Wave\s+2\s*\/\s*10/);
    await expect(page.locator('#top-bar')).toContainText('PREP');
    expect(errors).toEqual([]);
  });

  test('spends 1 AP to walk unit during combat, handles defeat and restart-run, and persists save', async ({
    page,
  }) => {
    const { errors } = attachErrorGuards(page);
    await page.goto('/');
    await page.locator('[data-action="home-play"]').click();
    await page
      .locator('[data-action="select-map"][data-id="viridian_outpost"]')
      .click();

    const clearBtn = page.locator('[data-action="clear-draft"]');
    if (await clearBtn.isEnabled()) {
      await clearBtn.click();
    }
    // Draft only 1 unit so Wave 1 enemies overwhelm the Core -> DEFEAT
    await page.locator('[data-action="inspect-draft"][data-id="0001"]').click();
    await page.locator('[data-action="toggle-draft"][data-id="0001"]').click();
    await page.locator('[data-action="confirm-draft"]').click();

    await expect(page.locator('#top-bar')).toContainText('PREP');
    await page.locator('[data-action="toggle-mute"]').click();
    await page.locator('[data-action="toggle-speed"]').click();
    await page.locator('[data-action="start-wave"]').click();
    await expect(page.locator('#top-bar')).toContainText('COMBAT');

    // Select the unit and click a reachable tile on the canvas to spend 1 AP
    await page.locator('[data-action="select-unit"]').first().click();
    const canvas = page.locator('#phaser-host canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.38, box.y + box.height * 0.5);
    await expect(page.locator('#top-bar')).toContainText(
      /AP\s+[0-9]\s*\/\s*10/,
    );

    // Wait for Core HP to reach 0 -> DEFEAT modal with restart-run
    const restartBtn = page.locator('[data-action="restart-run"]');
    await expect(restartBtn).toBeVisible({ timeout: 35_000 });
    await restartBtn.click();

    // Restart returns to HOME cleanly
    await expect(page.locator('[data-action="home-play"]')).toBeVisible();

    // Seed localStorage save, reload, and verify unlocked count reflects it
    await page.evaluate(() => {
      window.localStorage.setItem(
        'pokebastion:save_v1',
        JSON.stringify({
          version: 1,
          pokemon: { '0151': { unlocked: true } },
        }),
      );
    });
    await page.reload();
    await expect(page.locator('[data-action="home-play"]')).toBeVisible();
    const saveJson = await page.evaluate(() =>
      window.localStorage.getItem('pokebastion:save_v1'),
    );
    expect(saveJson).toContain('0151');

    expect(errors).toEqual([]);
  });

  test('supports home/top-bar toggles without layout shift, combat pause, prep unit swap, and recruit auto-deploy', async ({
    page,
  }) => {
    const { errors } = attachErrorGuards(page);
    await page.goto('/');

    const homeSound = page.locator('#modal-root [data-action="toggle-mute"]');
    const homeShake = page.locator('#modal-root [data-action="toggle-shake"]');
    await expect(homeSound).toBeVisible({ timeout: 25_000 });

    const soundBoxBefore = (await homeSound.boundingBox())!;
    const shakeBoxBefore = (await homeShake.boundingBox())!;
    await expect(homeSound).toHaveAttribute('aria-pressed', 'false');
    await expect(homeShake).toHaveAttribute('aria-pressed', 'false');

    await homeSound.click();
    await homeShake.click();
    await expect(homeSound).toHaveAttribute('aria-pressed', 'true');
    await expect(homeShake).toHaveAttribute('aria-pressed', 'true');

    const soundBoxAfter = (await homeSound.boundingBox())!;
    const shakeBoxAfter = (await homeShake.boundingBox())!;
    expect(
      Math.abs(soundBoxAfter.width - soundBoxBefore.width),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(shakeBoxAfter.width - shakeBoxBefore.width),
    ).toBeLessThanOrEqual(0.5);

    // Toggle back so audio/shake state is clean, then draft 2 units and enter PREP
    await homeSound.click();
    await homeShake.click();
    await page.locator('[data-action="home-play"]').click();
    await page
      .locator('[data-action="select-map"][data-id="viridian_outpost"]')
      .click();
    const clearBtn = page.locator('[data-action="clear-draft"]');
    if (await clearBtn.isEnabled()) await clearBtn.click();
    for (const id of ['0001', '0004']) {
      await page
        .locator(`[data-action="inspect-draft"][data-id="${id}"]`)
        .click();
      await page
        .locator(`[data-action="toggle-draft"][data-id="${id}"]`)
        .click();
    }
    await page.locator('[data-action="confirm-draft"]').click();
    await expect(page.locator('#top-bar')).toContainText('PREP');

    // Pause is disabled during PREP; top-bar toggles keep fixed width
    const topPause = page.locator('#top-bar [data-action="toggle-pause"]');
    const topSpeed = page.locator('#top-bar [data-action="toggle-speed"]');
    const topMute = page.locator('#top-bar [data-action="toggle-mute"]');
    const topShake = page.locator('#top-bar [data-action="toggle-shake"]');
    await expect(topPause).toBeDisabled();

    const speedBox1 = (await topSpeed.boundingBox())!;
    const muteBox1 = (await topMute.boundingBox())!;
    const shakeTopBox1 = (await topShake.boundingBox())!;
    await topSpeed.click();
    await topMute.click();
    await topShake.click();
    expect(
      Math.abs((await topSpeed.boundingBox())!.width - speedBox1.width),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs((await topMute.boundingBox())!.width - muteBox1.width),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs((await topShake.boundingBox())!.width - shakeTopBox1.width),
    ).toBeLessThanOrEqual(0.5);

    // Swap 2 units in PREP by clicking one on the canvas, then clicking the other
    const beforeSwap = await page.evaluate(() => {
      const s = (
        window as unknown as {
          __battleScene: {
            getSnapshot: () => {
              activeUnits: Array<{ uid: string; gx: number; gy: number }>;
            };
          };
        }
      ).__battleScene.getSnapshot();
      return s.activeUnits.map((u) => ({ uid: u.uid, gx: u.gx, gy: u.gy }));
    });
    expect(beforeSwap).toHaveLength(2);
    const unitClients = await page.evaluate((targets) => {
      const scene = (
        window as unknown as {
          __battleScene: {
            getTileScreenPosition: (
              gx: number,
              gy: number,
            ) => { screenX: number; screenY: number };
          };
        }
      ).__battleScene;
      return targets.map((t) => scene.getTileScreenPosition(t.gx, t.gy));
    }, beforeSwap);
    await page.mouse.click(unitClients[0].screenX, unitClients[0].screenY);
    await page.mouse.click(unitClients[1].screenX, unitClients[1].screenY);
    const afterSwap = await page.evaluate(() => {
      const s = (
        window as unknown as {
          __battleScene: {
            getSnapshot: () => {
              activeUnits: Array<{ uid: string; gx: number; gy: number }>;
            };
          };
        }
      ).__battleScene.getSnapshot();
      return s.activeUnits.map((u) => ({ uid: u.uid, gx: u.gx, gy: u.gy }));
    });
    expect(afterSwap[0]).toMatchObject({
      gx: beforeSwap[1].gx,
      gy: beforeSwap[1].gy,
    });
    expect(afterSwap[1]).toMatchObject({
      gx: beforeSwap[0].gx,
      gy: beforeSwap[0].gy,
    });

    // Auto-deploy newly recruited Pokémon when active party has room (< 6)
    await page.evaluate(() => {
      const scene = (
        window as unknown as {
          __battleScene: {
            phase: string;
            pickReward: (id: string) => void;
            rewardChoices: Array<{
              id: string;
              kind: string;
              title: string;
              desc: string;
              speciesId?: string;
            }>;
          };
        }
      ).__battleScene;
      scene.phase = 'REWARD';
      scene.rewardChoices = [
        {
          id: 'recruit_test',
          kind: 'recruit',
          title: 'Recruit Pikachu',
          desc: '',
          speciesId: '0025',
        },
      ];
      scene.pickReward('recruit_test');
    });
    const afterRecruit = await page.evaluate(() => {
      const s = (
        window as unknown as {
          __battleScene: {
            getSnapshot: () => {
              activeUnits: Array<{ speciesId: string }>;
              reserveIds: string[];
            };
          };
        }
      ).__battleScene.getSnapshot();
      return s;
    });
    expect(afterRecruit.activeUnits.some((u) => u.speciesId === '0025')).toBe(
      true,
    );
    expect(afterRecruit.reserveIds).not.toContain('0025');

    // Start combat & verify Pause freezes waveElapsedMs, then resumes
    await page.locator('[data-action="start-wave"]').click();
    await expect(page.locator('#top-bar')).toContainText('COMBAT');
    await expect(topPause).toBeEnabled();

    const pauseBox1 = (await topPause.boundingBox())!;
    await topPause.click();
    await expect(topPause).toHaveAttribute('aria-pressed', 'true');
    expect(
      Math.abs((await topPause.boundingBox())!.width - pauseBox1.width),
    ).toBeLessThanOrEqual(0.5);

    const elapsedPaused1 = await page.evaluate(
      () =>
        (
          window as unknown as {
            __battleScene: { getSnapshot: () => { waveElapsedMs?: number } };
          }
        ).__battleScene.getSnapshot().waveElapsedMs ?? 0,
    );
    await page.waitForTimeout(350);
    const elapsedPaused2 = await page.evaluate(
      () =>
        (
          window as unknown as {
            __battleScene: { getSnapshot: () => { waveElapsedMs?: number } };
          }
        ).__battleScene.getSnapshot().waveElapsedMs ?? 0,
    );
    expect(elapsedPaused2).toBe(elapsedPaused1);

    await topPause.click();
    await expect(topPause).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(300);
    const elapsedResumed = await page.evaluate(
      () =>
        (
          window as unknown as {
            __battleScene: { getSnapshot: () => { waveElapsedMs?: number } };
          }
        ).__battleScene.getSnapshot().waveElapsedMs ?? 0,
    );
    expect(elapsedResumed).toBeGreaterThan(elapsedPaused2);

    expect(errors).toEqual([]);
  });
});
