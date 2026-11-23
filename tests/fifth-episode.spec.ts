import { selectEpisodeFromMenu } from './helpers/workshop';
import { expect, test, type Page } from '@playwright/test';
import { talk, field, finishTalk, unlockEgg } from './helpers/workshop';

const right = [
  'up',
  'up',
  'down',
  'right',
  'right',
  'up',
  'left',
  'left',
  'down',
  'left',
  'up',
];
const left = [
  'up',
  'up',
  'down',
  'left',
  'left',
  'left',
  'up',
  'right',
  'down',
  'right',
  'up',
];
const keys: Record<string, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};
const buttons: Record<string, string> = {
  up: 'Вверх',
  down: 'Вниз',
  left: 'Влево',
  right: 'Вправо',
};
async function move(page: Page, directions: string[], touch = false) {
  for (const direction of directions) {
    if (touch)
      await page
        .getByRole('button', { name: buttons[direction]!, exact: true })
        .tap();
    else await page.keyboard.press(keys[direction]!);
  }
}

test('episode five: contrasting sounds, both alternatives, corrections and independent room histories', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await unlockEgg(page);
  await finishTalk(page, 'Начать просьбу');
  await move(page, right);
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page
    .getByRole('button', { name: 'Любое одно; an перед гласным звуком' })
    .click();
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
  const canvas = await page.locator('canvas').elementHandle();
  await expect(talk(page)).toContainText('Соберём сумку и для него');
  await finishTalk(page, 'Начать просьбу');
  await expect(field(page)).toHaveAttribute('data-columns', '7');
  await expect(field(page)).toHaveAttribute('data-rows', '4');
  await page.screenshot({ path: info.outputPath('choice-key-start.png') });
  const wrongKey = [
    'up',
    'up',
    'down',
    'left',
    'left',
    'left',
    'left',
    'up',
    'right',
    'right',
    'down',
    'right',
    'up',
  ];
  await move(page, wrongKey, mobile);
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an key');
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(page.getByRole('status')).toContainText('согласного звука /k/');
  await expect(talk(page)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('choice-key-error.png') });
  for (let i = 0; i < wrongKey.length; i++) await page.keyboard.press('KeyZ');
  await move(page, right, mobile);
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('a key');
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(
    page.getByRole('button', { name: 'Следующая просьба' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Потому что этот блок стоял справа' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Положение таблички не определяет артикль',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'Один любой ключ; key начинается с /k/' })
    .click();
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
  await expect(talk(page)).toContainText('Ключ уже в сумке помощника');
  await finishTalk(page, 'Начать просьбу');
  await page.screenshot({ path: info.outputPath('choice-apple-start.png') });
  const wrongApple = [
    'up',
    'up',
    'down',
    'right',
    'right',
    'right',
    'up',
    'left',
    'left',
    'left',
    'down',
    'left',
    'up',
  ];
  await move(page, wrongApple, mobile);
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('a apple');
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(page.getByRole('status')).toContainText('гласного звука /æ/');
  for (let i = 0; i < wrongApple.length; i++) await page.keyboard.press('KeyZ');
  await move(page, left, mobile);
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an apple');
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(talk(page)).toContainText('сумке помощника');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page
    .getByRole('button', { name: 'Нужна a, как в просьбе с ключом' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'начальный звук изменился',
  );
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole('button', { name: 'Выбрать другой ответ' }),
  ).toBeInViewport();
  await page.screenshot({
    path: info.outputPath('choice-apple-reflection.png'),
  });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByText('Вспомнить правило a/an', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('две формы');
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(talk(page).getByRole('status')).toContainText(
    'начальный звук изменился',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'Один любой плод; apple начинается с /æ/' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Следующая просьба' }),
  ).toHaveCount(1);
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: info.outputPath('choice-finished.png') });
  await talk(page).getByRole('button', { name: 'В мастерскую' }).click();
  await page.keyboard.press('KeyZ');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an apple');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'choiceKey');
  await expect(
    page.getByRole('button', { name: 'Один любой ключ; key начинается с /k/' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'choiceApple');
  await finishTalk(page, 'Начать просьбу');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('an apple');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page.getByRole('button', { name: 'Начать эпизод заново' }).click();
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('… …');
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
