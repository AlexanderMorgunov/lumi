import { expect, test, type Locator } from '@playwright/test';
import { field, finishTalk, talk } from './helpers/workshop';

async function width(locator: Locator) {
  return (await locator.boundingBox())?.width ?? 0;
}

test('mobile dialogue fills the game and can reveal the same room without advancing', async ({
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
  await expect(scene).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => width(dialogue)).toBe(740);

  await finishTalk(page, 'Собрать просьбу');
  await expect(board).toBeFocused();
  await expect(board).toHaveAttribute('data-reference-location', 'table');
  expect(await canvas?.evaluate((node) => node.isConnected)).toBe(true);
  await expect(board.locator('canvas')).toHaveCount(1);
});
