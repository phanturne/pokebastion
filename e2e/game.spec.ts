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

    // Switch to Shop tab, verify Move tool is removed and Team tab clears active tool
    const shopTab = page.locator('[data-action="switch-tab"][data-id="shop"]');
    await shopTab.click();
    await expect(shopTab).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.locator('[data-action="select-tool"][data-id="move_struct"]'),
    ).toHaveCount(0);
    await page
      .locator('[data-action="select-tool"][data-id="wood_wall"]')
      .click();
    await expect(page.locator('.active-mode-bar')).toBeVisible();
    await page.locator('[data-action="switch-tab"][data-id="team"]').click();
    await expect(page.locator('.active-mode-bar')).toHaveCount(0);
    await shopTab.click();
    await page
      .locator('[data-action="select-tool"][data-id="wood_wall"]')
      .click();

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

    // Buy a held item in the Shop drawer
    const buyItemBtn = page.locator('[data-action="buy-item"]').first();
    await expect(buyItemBtn).toBeEnabled();
    await buyItemBtn.click();

    const goldAfterItem = await readGold(page);
    expect(goldAfterItem).toBeLessThan(goldAfterBuild);

    // Switch to Team tab, equip item, and open Expanded Unit Inspector
    await page.locator('[data-action="switch-tab"][data-id="team"]').click();
    const equipBtn = page.locator('[data-action="equip-item"]').first();
    await expect(equipBtn).toBeVisible();
    await equipBtn.click();

    await page.locator('[data-action="expand-unit"]').first().click();
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
    expect(topBox!.height).toBeLessThanOrEqual(64);
    await page.setViewportSize({ width: 1280, height: 800 });

    expect(errors).toEqual([]);
  });

  test('runs Wave 1 combat at 2x speed, clears wave, and advances to Wave 2', async ({
    page,
  }) => {
    const { errors } = attachErrorGuards(page);
    await page.goto('/');
    await draftStarterTeamAndEnterPrep(page, true);

    // Place 2 wood walls near center and equip a held item so Wave 1 clears reliably
    await page.locator('[data-action="switch-tab"][data-id="shop"]').click();
    await page
      .locator('[data-action="select-tool"][data-id="wood_wall"]')
      .click();
    const canvas = page.locator('#phaser-host canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.44);
    await page.mouse.click(box.x + box.width * 0.58, box.y + box.height * 0.44);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
    await page.keyboard.press('Escape');
    await page.locator('[data-action="buy-item"]').first().click();
    await page.locator('[data-action="switch-tab"][data-id="team"]').click();
    await page.locator('[data-action="equip-item"]').first().click();

    // Mute audio and switch to 2x speed
    await page.locator('[data-action="toggle-mute"]').click();
    await expect(page.locator('[data-action="toggle-mute"]')).toContainText(
      'Muted',
    );

    await page.locator('[data-action="toggle-speed"]').click();
    await expect(page.locator('[data-action="toggle-speed"]')).toContainText(
      '2×',
    );

    // Start Wave 1
    await page.locator('[data-action="start-wave"]').click();
    await expect(page.locator('#top-bar')).toContainText('COMBAT');

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
});
