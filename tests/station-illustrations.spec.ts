import { expect, test } from '@playwright/test';
import { field } from './helpers/workshop';

test('distinct children animate on passenger records, stay clear of the reading frame and respect pause/reduced motion', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 800, height: 360 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await page.getByRole('button', { name: /^Эпизод 10:/ }).click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  const talk = page.locator('.cat-dialogue');
  while (
    await talk.getByRole('button', { name: 'Дальше', exact: true }).count()
  )
    await talk.getByRole('button', { name: 'Дальше', exact: true }).click();
  await talk
    .getByRole('button', { name: 'Собрать подпись', exact: true })
    .click();
  await expect(field(page)).toHaveAttribute(
    'data-record-illustrations',
    'nora;nora,younger;',
  );
  if (info.project.name === 'desktop') {
    await expect(field(page)).toHaveAttribute('data-nora-frame', '3', {
      timeout: 15000,
    });
    await page.screenshot({ path: info.outputPath('nora-wave.png') });
    await expect(field(page)).toHaveAttribute('data-younger-frame', '3', {
      timeout: 15000,
    });
    await page.screenshot({ path: info.outputPath('younger-wave.png') });
    await page.getByRole('button', { name: 'Меню и пауза' }).click();
    await expect(field(page)).toHaveAttribute('data-nora-frame', '0');
    await expect(field(page)).toHaveAttribute('data-younger-frame', '0');
    await page.keyboard.press('Escape');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(field(page)).toHaveAttribute('data-nora-frame', '0');
  await expect(field(page)).toHaveAttribute('data-younger-frame', '0');
  await page.screenshot({ path: info.outputPath('children-still.png') });
  expect(errors).toEqual([]);
});
