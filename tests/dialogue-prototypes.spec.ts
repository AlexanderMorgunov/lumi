import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
for (const variant of ['a', 'b', 'c']) {
  test(`dialogue ${variant}: read, compare, play and replay`, async ({
    page,
  }, info) => {
    test.skip(
      !existsSync('docs/design/dialogue-prototypes/index.html'),
      'Historical design prototypes are local-only; game UI tests remain enabled.',
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/docs/design/dialogue-prototypes/#${variant}`);
    const preview = page.locator('#preview');
    await expect(preview).toHaveAttribute('data-variant', variant);
    await expect(page.locator('#line')).toContainText('Мяу');
    await page.locator('#next').click();
    await expect(page.locator('#line')).toContainText('несколько карточек');
    const current = await page.locator('#line').textContent();
    await page.locator('[data-choice="a"]').click();
    await page.locator('[data-choice="b"]').click();
    await page.locator(`[data-choice="${variant}"]`).click();
    await expect(page.locator('#line')).toHaveText(current!);
    await preview.focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#position')).toContainText('Ходов: 0');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
    await expect(page.locator('#next')).toContainText('Попробовать');
    const dialog = await page.locator('#dialogue').boundingBox();
    const hero = await page.locator('#lumi').boundingBox();
    expect(dialog).not.toBeNull();
    expect(hero).not.toBeNull();
    const overlap = Math.max(
      0,
      Math.min(dialog!.y + dialog!.height, hero!.y + hero!.height) -
        Math.max(dialog!.y, hero!.y),
    );
    expect(overlap).toBe(0);
    await preview.screenshot({
      path: info.outputPath(`dialogue-${variant}-long.png`),
    });
    await page.keyboard.press('Enter');
    await expect(preview).toHaveAttribute('data-phase', 'play');
    if (info.project.name === 'mobile')
      await page.getByRole('button', { name: 'Вверх', exact: true }).tap();
    else await page.keyboard.press('KeyW');
    await expect(page.locator('#phrase')).toHaveText('a cat');
    await page.locator('[data-choice="c"]').click();
    await expect(page.locator('#phrase')).toHaveText('a cat');
    await page.locator(`[data-choice="${variant}"]`).click();
    await page.getByRole('button', { name: 'Отменить ход' }).click();
    await expect(page.locator('#position')).toContainText('Ходов: 0');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(preview).toHaveAttribute('data-phase', 'success');
    await expect(page.locator('#line')).toContainText('Спасибо');
    await page.locator('#next').click();
    await expect(preview).toHaveAttribute('data-phase', 'talk');
    await expect(page.locator('#position')).toContainText('Ходов: 0');
    await page.locator('#phone').click();
    await expect(page.locator('#phone')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.locator('#phone').click();
    for (let i = 0; i < 4; i++) await page.locator('#next').click();
    await page.locator('#line').evaluate((el) => {
      el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`;
    });
    await page.locator('#next').scrollIntoViewIfNeeded();
    await expect(page.locator('#next')).toBeInViewport();
    await page.locator('#line').focus();
    await page.keyboard.press('End');
    await page.locator('#next').click();
    await expect(preview).toHaveAttribute('data-phase', 'play');
  });
}
