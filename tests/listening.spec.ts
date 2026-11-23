import { expect, test } from '@playwright/test';
import { field, finishTalk, talk, unlockEgg } from './helpers/workshop';

test('listen on plaques without moving, keyboard activation, resize and return', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Слушать слова на поле' }).click();
  await expect(
    page.getByRole('button', { name: 'Вверх', exact: true }),
  ).toBeDisabled();
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const target = page.getByRole('button', { name: 'Послушать cat на поле' });
    await expect(target).toBeInViewport();
    await target.click();
    await expect(page.locator('.listening-bar')).toContainText(
      'Можно послушать ещё раз',
      { timeout: 6000 },
    );
    await target.focus();
    await page.keyboard.press('Enter');
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('KeyW');
    await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.word-hit-layer')).toHaveCount(0);
  await expect(field(page)).toBeFocused();
  await page.keyboard.press('KeyD');
  await expect(talk(page)).toContainText('Первая просьба');
});

test('dialogue English words play directly; next line and menu stop audio', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.keyboard.press('KeyD');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  const word = talk(page).getByRole('button', {
    name: 'Послушать an',
    exact: true,
  });
  await word.click();
  await expect(word).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.keyboard.press('Escape');
  await expect(word).toHaveAttribute('aria-pressed', 'false');
  await word.click();
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    talk(page).getByRole('button', { name: 'Остановить звук' }),
  ).toHaveCount(0);
  await expect(talk(page)).toContainText('cat — кот');
  await talk(page)
    .getByRole('button', { name: 'Послушать cat', exact: true })
    .first()
    .click();
  await expect(page.locator('.dialogue-speech-status')).toContainText(
    'Можно послушать ещё раз',
    { timeout: 6000 },
  );
  await expect(page.locator('.sr-only')).toContainText('Ходов: 1');
});

test('seven-column board exposes both article choices and reports failed playback without moving', async ({
  page,
}) => {
  await unlockEgg(page);
  await finishTalk(page, 'Начать просьбу');
  await page.getByRole('button', { name: 'Слушать слова на поле' }).click();
  await expect(page.getByText('Игра на паузе', { exact: true })).toHaveCount(0);
  for (const word of ['a', 'an', 'egg']) {
    const target = page.getByRole('button', {
      name: `Послушать ${word} на поле`,
      exact: true,
    });
    await expect(target).toBeVisible();
    if (word !== 'egg') {
      await target.click();
      await expect(target).toHaveAttribute('aria-pressed', 'true');
    }
  }
  await page.route('**/audio/en-US/lessac-v1/egg.wav', (route) =>
    route.abort(),
  );
  await page.getByRole('button', { name: 'Послушать egg на поле' }).click();
  await expect(page.locator('.listening-bar')).toContainText(
    /Не удалось|не запустил/,
  );
  await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  await page.unroute('**/audio/en-US/lessac-v1/egg.wav');
  await page.getByRole('button', { name: 'Послушать egg на поле' }).click();
  await expect(page.locator('.listening-bar')).toContainText(
    'Можно послушать ещё раз',
    { timeout: 6000 },
  );
});
