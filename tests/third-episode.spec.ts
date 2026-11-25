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

test('third request: learn an, explain its sound, undo and revisit all episodes', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
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
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
  await finishTalk(page, 'Начать просьбу');
  for (const key of [
    'KeyA',
    'KeyW',
    'KeyS',
    'KeyD',
    'KeyD',
    'KeyD',
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyA',
    'KeyW',
  ])
    await page.keyboard.press(key);
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Следующая просьба' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Один любой подходящий ключ' })
    .click();
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'apple',
  );
  await expect(
    talk(page).getByRole('heading', { name: 'Яблоко для Марты' }),
  ).toBeVisible();
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(talk(page)).toContainText('гласный');
  await page.screenshot({ path: info.outputPath('apple-lesson.png') });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('не по букве');
  await expect(
    page.getByRole('dialog').getByRole('img', { name: 'Рисованное яблоко' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(talk(page)).toContainText('гласный');
  await finishTalk(page, 'Собрать просьбу');
  await expect(field(page)).toBeFocused();
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an …');
  await page.screenshot({ path: info.outputPath('apple-start.png') });
  if (mobile)
    await page.getByRole('button', { name: 'Вверх', exact: true }).tap();
  else await page.keyboard.press('ArrowUp');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an apple');
  await page.screenshot({ path: info.outputPath('apple-phrase.png') });
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(talk(page)).toContainText('Яблоко в сумке');
  await page.screenshot({ path: info.outputPath('apple-delivered.png') });
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    talk(page).getByRole('button', { name: 'В мастерскую' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Потому что яблок несколько' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'единственном числе',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page.getByRole('button', { name: 'Потому что это фрукт' }).click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Вид предмета не определяет',
  );
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole('button', { name: 'Выбрать другой ответ' }),
  ).toBeInViewport();
  await page.screenshot({ path: info.outputPath('apple-retry.png') });
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'В apple первый звук — гласный' })
    .click();
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  await expect(talk(page).getByRole('status')).toContainText(
    'форма зависит от следующего звука',
  );
  await page.screenshot({ path: info.outputPath('apple-explained.png') });
  await talk(page).getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.keyboard.press('KeyZ');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an apple');
  await page.screenshot({ path: info.outputPath('apple-undone.png') });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'cat');
  await expect(talk(page)).toContainText('Первая просьба выполнена');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'key');
  await expect(talk(page)).toContainText('Ключ в дорожной сумке');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'apple');
  await finishTalk(page, 'Собрать просьбу');
  await expect(page.locator('.sr-only')).toContainText('Ходов: 1');
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'В apple первый звук — гласный' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await talk(page).getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an …');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('гласного звука');
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
