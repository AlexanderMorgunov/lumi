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
  const scene = page.getByRole('button', { name: 'Показать сцену' });
  const hide = page.getByRole('button', { name: 'Скрыть сцену' });
  const boardSpace = page.locator('.landscape-board-space');
  const mobile = info.project.name === 'mobile';
  const next = dialogue.getByRole('button', { name: 'Дальше', exact: true });
  await expect(board).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15_000,
  });
  await expect(dialogue).toContainText('вот он, посередине');
  if (mobile) {
    await expect(boardSpace).toBeVisible();
    await expect(hide).toHaveAttribute('aria-expanded', 'true');
    await hide.tap();
    await expect(boardSpace).toBeHidden();
  } else {
    await expect(
      dialogue.getByRole('button', { name: 'Показать сцену' }),
    ).toBeVisible();
    await expect.poll(() => width(dialogue)).toBe(390);
  }
  const canvas = await board.locator('canvas').elementHandle();

  await scene.click();
  await expect(hide).toBeFocused();
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  if (mobile) await expect(boardSpace).toBeVisible();
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
  if (mobile) await expect(boardSpace).toBeHidden();
  else await expect.poll(() => width(dialogue)).toBe(390);

  await next.click();
  await next.click();
  await expect(dialogue.getByRole('heading')).toHaveText(
    'Смысл важнее повторения',
  );
  await page.screenshot({ path: info.outputPath('key-dialogue-portrait.png') });
  await page.setViewportSize({ width: 740, height: 322 });
  if (mobile) await expect(boardSpace).toBeHidden();
  else await expect.poll(() => width(dialogue)).toBe(740);
  await expect(dialogue.getByRole('heading')).toHaveText(
    'Смысл важнее повторения',
  );
  await expect(next).toBeInViewport();
  await page.screenshot({
    path: info.outputPath('key-dialogue-landscape.png'),
  });
  await scene.click();
  if (mobile) await expect(boardSpace).toBeVisible();
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
}, info) => {
  await page.setViewportSize({ width: 390, height: 660 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  const board = field(page);
  const dialogue = talk(page);
  await expect(board).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15_000,
  });
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Скрыть сцену' }).tap();
  await page.getByRole('button', { name: 'Показать сцену' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await page.getByRole('button', { name: 'Вправо', exact: true }).click();
  await expect(dialogue).toContainText('Первая просьба');
  await expect(
    page.getByRole('button', { name: 'Скрыть сцену' }),
  ).toHaveAttribute('aria-expanded', 'true');
});

test('the full station result stays readable beside the scene on a phone', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Touch layout');
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await page.getByRole('button', { name: /^Эпизод 1: Имя/ }).click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();

  const board = field(page);
  const boardSpace = page.locator('.landscape-board-space');
  const dialogue = page.locator('.cat-dialogue');
  const next = dialogue.getByRole('button', { name: 'Дальше', exact: true });
  await expect(board).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15_000,
  });
  await expect(boardSpace).toBeVisible();
  while (await next.count()) await next.tap();
  await dialogue.getByRole('button', { name: 'Собрать сообщение' }).tap();
  await board.press('ArrowUp');
  await page.getByRole('button', { name: /Передать сообщение/ }).tap();
  await next.tap();

  const marta = page.getByRole('region', { name: 'Разговор с Мартой' });
  const reply = marta.locator('.cat-line');
  const advance = marta.getByRole('button', { name: 'Следующая часть' });
  const backToBoard = marta.getByRole('button', { name: 'Вернуться к полю' });
  const restart = marta.getByRole('button', { name: 'Начать эпизод заново…' });
  await expect(reply).toContainText('Тик уже подписал твою бирку');
  for (const viewport of [
    { width: 568, height: 320 },
    { width: 740, height: 322 },
    { width: 390, height: 660 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(boardSpace).toBeInViewport({ ratio: 1 });
    await expect(advance).toBeInViewport({ ratio: 1 });
    await expect(backToBoard).toBeInViewport({ ratio: 1 });
    await expect(restart).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: info.outputPath(`marta-result-${viewport.width}.png`),
    });
    await expect
      .poll(() =>
        reply.evaluate((node) => node.scrollHeight - node.clientHeight),
      )
      .toBeLessThanOrEqual(1);
    const sceneBounds = (await boardSpace.boundingBox())!;
    const replyBounds = (await marta.boundingBox())!;
    if (viewport.width > viewport.height)
      expect(sceneBounds.x + sceneBounds.width).toBeLessThan(replyBounds.x);
    else expect(sceneBounds.y + sceneBounds.height).toBeLessThan(replyBounds.y);
  }
  const toolbar = page.getByRole('navigation', { name: 'Игровые панели' });
  await toolbar.getByRole('button', { name: 'Скрыть сцену' }).tap();
  const show = toolbar.getByRole('button', { name: 'Показать сцену' });
  const menu = toolbar.getByRole('button', { name: 'Меню и пауза' });
  await expect(show).toBeInViewport({ ratio: 1 });
  await expect(menu).toBeInViewport({ ratio: 1 });
  const showBounds = (await show.boundingBox())!;
  const menuBounds = (await menu.boundingBox())!;
  expect(Math.abs(showBounds.y - menuBounds.y)).toBeLessThan(2);
  await expect(advance).toBeInViewport({ ratio: 1 });
  await show.tap();
  await restart.tap();
  await expect(
    page.getByRole('dialog', { name: 'Начать заново?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Отмена', exact: true }).tap();
  await expect(reply).toContainText('Тик уже подписал твою бирку');
  await backToBoard.tap();
  await expect(board).toBeFocused();
  await expect(
    page.getByText('Имя записано на бирке', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Имена на бирках' }).tap();
  await next.tap();
  await advance.tap();
  await expect(board).toHaveAttribute('data-level-id', 'chapter-02-01-marta');
});
