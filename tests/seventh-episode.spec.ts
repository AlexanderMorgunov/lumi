import { selectEpisodeFromMenu } from './helpers/workshop';
import { expect, test } from '@playwright/test';
import { field, talk, finishTalk, unlockThe } from './helpers/workshop';

test('the apple: three article choices, distinct feedback and the left gift follows Undo and navigation', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await unlockThe(page);
  await finishTalk(page, 'Собрать просьбу');
  const right = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowRight',
    'ArrowRight',
    'ArrowUp',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowDown',
    'ArrowLeft',
    'ArrowUp',
  ];
  for (const key of right) await page.keyboard.press(key);
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Следующая просьба' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', {
      name: 'Кот и Люми понимают, какой именно ключ нужен',
    })
    .click();
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
  const canvas = await page.locator('canvas').elementHandle();
  await expect(talk(page)).toContainText('зелёное яблоко слева');
  await expect(field(page)).toHaveAttribute(
    'data-reference-target',
    'keeper-apple',
  );
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await finishTalk(page, 'Начать просьбу');
  await expect(field(page)).toBeFocused();
  await page.screenshot({ path: info.outputPath('apple-three-articles.png') });
  const trials = [
    {
      keys: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowUp'],
      phrase: 'an apple',
      feedback: 'грамматически верное сочетание',
    },
    {
      keys: [
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
      ],
      phrase: 'a apple',
      feedback: 'неверно по форме',
    },
  ];
  for (const trial of trials) {
    for (const key of trial.keys) await page.keyboard.press(key);
    await expect(page.getByLabel('Слова в рамке чтения')).toHaveText(
      trial.phrase,
    );
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText(trial.feedback);
    await expect(talk(page)).toHaveCount(0);
    await expect(field(page)).toHaveAttribute(
      'data-reference-location',
      'table',
    );
    await page.screenshot({
      path: info.outputPath(`${trial.phrase.replace(' ', '-')}-feedback.png`),
    });
    for (let i = 0; i < trial.keys.length; i++)
      await page.keyboard.press('KeyZ');
  }
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
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('the apple');
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(talk(page)).toContainText('Зелёное яблоко в сумке');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'bag');
  await page.screenshot({ path: info.outputPath('apple-gift-delivered.png') });
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page
    .getByRole('button', { name: 'Перед гласным всегда нужен an' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'когда нужен неопределённый артикль',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', { name: 'Любое знакомое слово требует the' })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Знать слово apple недостаточно',
  );
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole('button', { name: 'Выбрать другой ответ' }),
  ).toBeInViewport();
  await page.screenshot({
    path: info.outputPath('apple-reflection-error.png'),
  });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Левое зелёное яблоко — подарок смотрителю: в сумке Марты',
  );
  await expect(page.getByRole('dialog')).toContainText(
    'Среднее яблоко — запас мастерской: на столе',
  );
  await expect(page.getByRole('dialog')).toContainText(
    'Правое яблоко — запас мастерской: на столе',
  );
  await page
    .getByText('Правило the и отличие от a/an', { exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'An apple — какое-нибудь одно яблоко',
  );
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Знать слово apple недостаточно',
  );
  await page.getByRole('button', { name: 'Выбрать другой ответ' }).click();
  await page
    .getByRole('button', {
      name: 'Яблоко указано обоим; гласный звук не отменяет the',
    })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Кот показал яблоко, и Люми понял, какое нужно',
  );
  await talk(page).getByRole('button', { name: 'В мастерскую' }).click();
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  await page.keyboard.press('KeyZ');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await page.screenshot({ path: info.outputPath('apple-gift-undone.png') });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'theKey');
  await expect(field(page)).toHaveAttribute(
    'data-reference-target',
    'workshop-key',
  );
  await expect(field(page)).toHaveAttribute('data-reference-location', 'bag');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'theApple');
  await finishTalk(page, 'Начать просьбу');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('the apple');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Яблоко указано обоим; гласный звук не отменяет the',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  await talk(page).getByRole('button', { name: 'В мастерскую' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page.getByRole('button', { name: 'Начать эпизод заново' }).click();
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await expect(page.getByLabel('Слова в рамке чтения')).toHaveText('… …');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑');
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});
