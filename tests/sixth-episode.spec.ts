import { selectEpisodeFromMenu } from './helpers/workshop';
import { expect, test } from '@playwright/test';
import { field, talk, finishTalk, unlockThe } from './helpers/workshop';

test('the key: shared reference, grammatical alternative, exact object delivery and context recovery', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await unlockThe(page);
  const canvas = await page.locator('canvas').elementHandle();
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'theKey',
  );
  await expect(talk(page)).toContainText('вот он, посередине');
  await expect(field(page)).toHaveAttribute(
    'data-reference-target',
    'workshop-key',
  );
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(talk(page)).toContainText('определённый артикль');
  await page.screenshot({ path: info.outputPath('the-introduction.png') });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Средний ключ — от двери мастерской: на столе',
  );
  await page
    .getByText('Правило the и отличие от a/an', { exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Не обязательно сначала говорить об этом ключе',
  );
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(talk(page)).toContainText('определённый артикль');
  await finishTalk(page, 'Собрать просьбу');
  await expect(field(page)).toBeFocused();
  await page.screenshot({ path: info.outputPath('the-start.png') });
  const alternative = [
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
  for (const key of alternative) await page.keyboard.press(key);
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('a key');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText(
    'грамматически верное сочетание',
  );
  await expect(talk(page)).toHaveCount(0);
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await page.screenshot({ path: info.outputPath('the-context-feedback.png') });
  for (let i = 0; i < alternative.length; i++)
    await page.keyboard.press('KeyZ');
  for (const direction of [
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
  ]) {
    const button = page.getByRole('button', { name: direction, exact: true });
    if (mobile) await button.tap();
    else await button.click();
  }
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('the key');
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(talk(page)).toContainText('Вот ключ от двери');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'bag');
  await page.screenshot({ path: info.outputPath('the-delivered.png') });
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page
    .getByRole('button', { name: 'Потому что слово key уже встречалось' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Повторения слова недостаточно',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'Потому что key начинается с согласного' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText('но не выбор the');
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole('button', { name: 'Выбрать другой ответ' }),
  ).toBeInViewport();
  await page.screenshot({ path: info.outputPath('the-reflection-error.png') });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Средний ключ — от двери мастерской: в сумке Марты',
  );
  await expect(page.getByRole('dialog')).toContainText(
    'Левый ключ — от шкафа: на столе',
  );
  await expect(page.getByRole('dialog')).toContainText(
    'Правый ключ — от сундука: на столе',
  );
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', {
      name: 'Кот и Люми понимают, какой именно ключ нужен',
    })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'даже если этот ключ ещё не обсуждали',
  );
  await talk(page).getByRole('button', { name: 'Вернуться к полю' }).click();
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  await page.keyboard.press('KeyZ');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await page.screenshot({ path: info.outputPath('the-undone.png') });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'choiceApple');
  await expect(field(page)).toHaveAttribute('data-reference-target', '');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'theKey');
  await finishTalk(page, 'Собрать просьбу');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('the key');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await page.keyboard.press('Enter');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'bag');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Кот и Люми понимают, какой именно ключ нужен',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  await talk(page).getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('… …');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑');
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
