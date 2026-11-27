import { expect, test, type Locator } from '@playwright/test';
import { field, finishTalk, talk } from './helpers/workshop';

async function width(locator: Locator) {
  return (await locator.boundingBox())?.width ?? 0;
}

test('mobile dialogue keeps the chosen scene visibility between lines', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 660 });
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page.getByRole('button', { name: /^Эпизод 6:/ }).click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();

  const board = field(page);
  const dialogue = talk(page);
  const scene = dialogue.getByRole('button', { name: 'Показать сцену' });
  const hide = dialogue.getByRole('button', { name: 'Скрыть сцену' });
  const next = dialogue.getByRole('button', { name: 'Дальше', exact: true });
  await expect(board).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15_000,
  });
  await expect(dialogue).toContainText('вот он, посередине');
  await expect.poll(() => width(dialogue)).toBe(390);
  const canvas = await board.locator('canvas').elementHandle();

  await scene.click();
  await expect(hide).toBeFocused();
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => width(dialogue)).toBeLessThan(390);
  await expect(board).toHaveAttribute('data-reference-target', 'workshop-key');
  await expect(dialogue).toContainText('вот он, посередине');
  await page.screenshot({ path: info.outputPath('key-scene-portrait.png') });
  await next.click();
  await expect(dialogue.getByRole('heading')).toHaveText(
    'The — определённый артикль',
  );
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => width(dialogue)).toBeLessThan(390);
  await dialogue.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(dialogue).toContainText('вот он, посередине');
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await hide.click();
  await expect(scene).toBeFocused();
  await expect.poll(() => width(dialogue)).toBe(390);

  await next.click();
  await next.click();
  await expect(dialogue.getByRole('heading')).toHaveText(
    'Смысл важнее повторения',
  );
  await page.screenshot({ path: info.outputPath('key-dialogue-portrait.png') });
  await page.setViewportSize({ width: 740, height: 322 });
  await expect.poll(() => width(dialogue)).toBe(740);
  await expect(dialogue.getByRole('heading')).toHaveText(
    'Смысл важнее повторения',
  );
  await expect(next).toBeInViewport();
  await page.screenshot({
    path: info.outputPath('key-dialogue-landscape.png'),
  });
  await scene.click();
  await expect.poll(() => width(dialogue)).toBeLessThan(740);
  await page.screenshot({ path: info.outputPath('key-scene-landscape.png') });
  await next.click();
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => width(dialogue)).toBeLessThan(740);

  await finishTalk(page, 'Собрать просьбу');
  await expect(board).toBeFocused();
  await expect(board).toHaveAttribute('data-reference-location', 'table');
  expect(await canvas?.evaluate((node) => node.isConnected)).toBe(true);
  await expect(board.locator('canvas')).toHaveCount(1);
});

test('the selected scene visibility persists into the next dialogue', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 660 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  const board = field(page);
  const dialogue = talk(page);
  await expect(board).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15_000,
  });
  await dialogue.getByRole('button', { name: 'Показать сцену' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await page.getByRole('button', { name: 'Вправо', exact: true }).click();
  await expect(dialogue).toContainText('Первая просьба');
  await expect(
    dialogue.getByRole('button', { name: 'Скрыть сцену' }),
  ).toHaveAttribute('aria-expanded', 'true');
});
