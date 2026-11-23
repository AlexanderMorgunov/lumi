import { expect, test } from '@playwright/test';
import { field } from './helpers/workshop';

test('development map opens locked station directly without completing workshop', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await expect(page.locator('.station-map')).toHaveCSS(
    'background-image',
    /station-road/,
  );
  await page.screenshot({ path: info.outputPath('station-road.png') });
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.screenshot({
      path: info.outputPath('station-road-landscape.png'),
    });
  }
  await page.getByRole('button', { name: /^Эпизод 1: Имя/ }).click();
  await expect(
    page.getByRole('button', { name: 'Эпизод пока закрыт' }),
  ).toBeDisabled();
  const preview = page.getByRole('button', {
    name: 'DEV · Открыть эпизод',
    exact: true,
  });
  await preview.scrollIntoViewIfNeeded();
  // Allow fractional-pixel clipping after native dialog scrolling.
  await expect(preview).toBeInViewport({ ratio: 0.99 });
  await expect(
    page.getByRole('button', { name: 'Закрыть описание эпизода' }),
  ).toBeInViewport({ ratio: 0.99 });
  await page.screenshot({ path: info.outputPath('development-preview.png') });
  await preview.click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-01');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready');
  await expect(
    page.getByRole('region', { name: 'Дорога к станции' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Разговор с Тиком' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await expect(page.locator('.station-map .completed')).toHaveCount(0);
  await expect(page.locator('.station-map .road-lumi')).toBeVisible();
  await page.screenshot({ path: info.outputPath('station-road-current.png') });
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('0');
  await expect(page.locator('.overview-footer')).toContainText('0 из 12');
  await page.getByRole('button', { name: /^Эпизод 5:/ }).click();
  await page
    .getByRole('button', { name: 'DEV · Открыть просьбу о яблоке' })
    .click();
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'choiceApple',
  );
  await page.reload();
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await expect(page.locator('.overview-footer')).toContainText('0 из 12');
});
