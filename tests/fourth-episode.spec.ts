import { selectEpisodeFromMenu } from './helpers/workshop';
import { expect, test } from '@playwright/test';
import { talk, field, finishTalk, unlockEgg } from './helpers/workshop';

test('fourth request: independent an transfer, recovery, explanation and navigation', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await unlockEgg(page);
  const canvas = await page.locator('canvas').elementHandle();
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'egg',
  );
  await expect(talk(page)).toContainText('яйцо — egg');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(talk(page)).toContainText('Первый звук /e/ — гласный');
  await page.screenshot({ path: info.outputPath('egg-introduction.png') });
  await finishTalk(page, 'Начать просьбу');
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveAttribute('data-columns', '7');
  await expect(field(page)).toHaveAttribute('data-rows', '4');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('… …');
  await expect(page.locator('.game-toast')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('egg-start.png') });
  // An unfinished move survives leaving a differently sized room.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('ещё не собрано');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'apple');
  await expect(talk(page)).toContainText('Перекус в дорогу');
  await expect(field(page)).toHaveAttribute('data-columns', '5');
  await expect(field(page)).toHaveAttribute('data-rows', '3');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'egg');
  await finishTalk(page, 'Начать просьбу');
  await expect(page.locator('.sr-only')).toContainText('Ходов: 1');
  await page.keyboard.press('KeyZ');
  await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  const wrongRoute = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowUp',
    'ArrowRight',
    'ArrowRight',
    'ArrowDown',
    'ArrowRight',
    'ArrowUp',
  ];
  for (const key of wrongRoute) await page.keyboard.press(key);
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('a egg');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Порядок слов верный');
  await expect(page.getByRole('status')).toContainText('гласного звука');
  await expect(talk(page)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Яйцо в сумке', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('egg-wrong-article.png') });
  for (let i = 0; i < wrongRoute.length; i++) await page.keyboard.press('KeyZ');
  await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  const route = [
    'Вверх',
    'Вверх',
    'Вниз',
    'Вправо',
    'Вправо',
    'Вверх',
    'Влево',
    'Влево',
    'Вниз',
    'Влево',
    'Вверх',
  ];
  for (const direction of route) {
    const button = page.getByRole('button', { name: direction, exact: true });
    if (mobile) await button.tap();
    else await button.click();
  }
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an egg');
  await page.screenshot({ path: info.outputPath('egg-phrase.png') });
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(talk(page)).toContainText('Яйцо в сумке');
  await page.screenshot({ path: info.outputPath('egg-delivered.png') });
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    talk(page).getByRole('button', { name: 'В мастерскую' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Все три яйца для привала' }).click();
  await expect(talk(page).getByRole('status')).toContainText(
    'единственное число',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'Только заранее указанное яйцо' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Нам подходит любое яйцо из трёх',
  );
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole('button', { name: 'Выбрать другой ответ' }),
  ).toBeInViewport();
  await page.screenshot({ path: info.outputPath('egg-retry.png') });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('два остались на столе');
  await page.getByText('Вспомнить правило a/an', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('an eggs — ошибка');
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Нам подходит любое яйцо из трёх',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'Любое одно; an перед гласным звуком' })
    .click();
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  await expect(talk(page).getByRole('status')).toContainText(
    'фрукт это или нет',
  );
  await page.screenshot({ path: info.outputPath('egg-explained.png') });
  await talk(page).getByRole('button', { name: 'В мастерскую' }).click();
  await page.keyboard.press('KeyZ');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an egg');
  await page.screenshot({ path: info.outputPath('egg-undone.png') });
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Любое одно; an перед гласным звуком' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await talk(page).getByRole('button', { name: 'В мастерскую' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page.getByRole('button', { name: 'Начать эпизод заново' }).click();
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('… …');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑');
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
