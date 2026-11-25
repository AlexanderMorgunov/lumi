import { selectEpisodeFromMenu } from './helpers/workshop';
import { expect, test, type Page } from '@playwright/test';

const talk = (page: Page) =>
  page.getByRole('region', { name: 'Разговор с котом' });
const field = (page: Page) =>
  page.getByRole('group', { name: /^Игровое поле/ });
async function finishTalk(page: Page, action: string) {
  while (
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  )
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
  await talk(page).getByRole('button', { name: action, exact: true }).click();
}
async function unlockKey(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.keyboard.press('KeyD');
  await finishTalk(page, 'Попробовать');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyW');
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Следующая просьба' }).click();
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'key',
  );
  await expect(talk(page)).toContainText('key, ключ от замка');
}
const route = [
  'Влево',
  'Вверх',
  'Вниз',
  'Вправо',
  'Вправо',
  'Вправо',
  'Вверх',
  'Влево',
  'Вниз',
  'Влево',
  'Вверх',
];

test('second request: transfer, explain, undo and replay on the same canvas', async ({
  page,
}, info) => {
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await unlockKey(page);
  const canvas = await page.locator('canvas').elementHandle();
  await page.screenshot({ path: info.outputPath('key-introduction.png') });
  await finishTalk(page, 'Начать просьбу');
  await expect(field(page)).toBeFocused();
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('… …');
  await expect(page.locator('.game-toast')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('key-start.png') });
  for (const direction of route) {
    const button = page.getByRole('button', { name: direction, exact: true });
    if (info.project.name === 'mobile') await button.tap();
    else await button.click();
  }
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('a key');
  await page.keyboard.press('Enter');
  await expect(talk(page)).toContainText(
    'Ключ в сумке. Два других оставим здесь',
  );
  await page.screenshot({ path: info.outputPath('key-delivered.png') });
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page.getByRole('button', { name: 'Несколько ключей сразу' }).click();
  await expect(talk(page).getByRole('status')).toContainText(
    'единственным числом',
  );
  await expect(
    talk(page).getByRole('button', { name: 'Выбрать другой ответ' }),
  ).toBeInViewport();
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: info.outputPath('key-meaning-retry.png') });
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('два остались на столе');
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(talk(page).getByRole('status')).toContainText(
    'единственным числом',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'Один любой подходящий ключ' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Мы попросили один ключ, и подошёл любой из трёх',
  );
  await page.screenshot({ path: info.outputPath('key-meaning-correct.png') });
  await talk(page).getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.keyboard.press('KeyZ');
  await expect(
    page.getByRole('button', { name: /Передать просьбу/ }),
  ).toBeEnabled();
  await page.keyboard.press('Enter');
  await talk(page)
    .getByRole('button', { name: 'Начать эпизод заново…' })
    .click();
  await page
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
  await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'key',
  );
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('… …');
  expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('key request survives navigation; hint and restart recover a trapped word', async ({
  page,
}) => {
  await unlockKey(page);
  await finishTalk(page, 'Начать просьбу');
  await page.keyboard.press('KeyD');
  await page.keyboard.press('KeyW');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('ещё не собрано');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'cat');
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'cat',
  );
  await expect(talk(page)).toContainText('Первая просьба выполнена');
  await talk(page).getByRole('button', { name: 'Следующая просьба' }).click();
  await finishTalk(page, 'Начать просьбу');
  await expect(page.locator('.sr-only')).toContainText('Ходов: 2');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('a key');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
  await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  for (const direction of route)
    await page.getByRole('button', { name: direction, exact: true }).click();
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(talk(page)).toContainText('Ключ в дорожной сумке');
});
