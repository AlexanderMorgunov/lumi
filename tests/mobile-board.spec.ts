import { expect, test, type Page } from '@playwright/test';
import { field, finishTalk, talk, unlockEgg } from './helpers/workshop';

const landscape = [
  { width: 568, height: 320 },
  { width: 740, height: 322 },
];
const portrait = { width: 390, height: 660 };
const narrowFrame = { width: 360, height: 322 };

const wordOnField = (page: Page, word: string) =>
  page.getByRole('button', { name: `Послушать ${word} на поле` });

test('phone landscape fits the grid and keeps movement, listening and undo usable through rotation', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(landscape[0]!);
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  const direction = (name: string) =>
    page.getByRole('button', { name, exact: true });
  const position = page.locator('.sr-only');
  const space = page.locator('.landscape-board-space');
  const undo = direction('Отмена');

  // Use a real tap in the touch project and a keyboard activation in Chrome desktop.
  if (info.project.name === 'mobile') await direction('Вправо').tap();
  else {
    await direction('Вправо').focus();
    await expect(direction('Вправо')).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(position).toContainText('столбец 4, ряд 3 · Ходов: 1');
  await expect(talk(page)).toContainText('Первая просьба');
  await finishTalk(page, 'Попробовать');

  for (const viewport of landscape) {
    await page.setViewportSize(viewport);
    await expect(space).toBeVisible();
    for (const name of ['Вверх', 'Влево', 'Вниз', 'Вправо']) {
      const arrow = direction(name);
      await expect(arrow).toBeInViewport({ ratio: 1 });
      const box = (await arrow.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(arrow).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
    await direction('Влево').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(direction('Вверх')).toBeFocused();
    await expect(direction('Вверх')).toHaveCSS('outline-style', 'solid');
    await field(page).focus();
    await expect(undo).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.phrase-action')).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: info.outputPath(
        `workshop-${viewport.width}x${viewport.height}.png`,
      ),
    });

    await direction('Слушать слова на поле').click();
    const tile = (word: string) => wordOnField(page, word);
    await expect(tile('cat')).toBeInViewport({ ratio: 1 });
    await expect(tile('a')).toBeInViewport({ ratio: 1 });
    const box = (await space.boundingBox())!;
    const zoom = Math.min(box.width / 1000, box.height / 420);
    await expect
      .poll(async () => {
        const article = (await tile('a').boundingBox())!;
        const noun = (await tile('cat').boundingBox())!;
        return Math.abs(
          noun.x + noun.width / 2 - article.x - article.width / 2 - 200 * zoom,
        );
      })
      .toBeLessThan(1);
    await expect(position).toContainText('Ходов: 1');
    await direction('К игре').click();
  }

  await direction('Влево').click();
  await expect(position).toContainText('столбец 3, ряд 3 · Ходов: 2');
  const board = (await space.boundingBox())!;
  const x = board.x + board.width / 2;
  const y = board.y + board.height * 0.8;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: y - 60 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(position).toContainText('столбец 3, ряд 2 · Ходов: 3');
  const phrase = page.getByLabel('Слова в рамке чтения');
  await expect(phrase).toContainText('cat');

  for (const viewport of [portrait, narrowFrame]) {
    await page.setViewportSize(viewport);
    if (viewport === portrait) await expect(space).toBeHidden();
    else await expect(space).toBeVisible();
    await expect(position).toContainText('столбец 3, ряд 2 · Ходов: 3');
    await expect(undo).toBeInViewport({ ratio: 1 });
    await expect(direction('Вверх')).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: info.outputPath(
        `workshop-${viewport.width}x${viewport.height}.png`,
      ),
    });
  }
  await direction('Слушать слова на поле').click();
  const narrowArticle = wordOnField(page, 'a');
  const narrowNoun = wordOnField(page, 'cat');
  await expect(narrowNoun).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () => {
      const article = (await narrowArticle.boundingBox())!;
      const noun = (await narrowNoun.boundingBox())!;
      return noun.x + noun.width / 2 - article.x - article.width / 2;
    })
    .toBeGreaterThan(60);
  await narrowNoun.click();
  await expect(narrowNoun).toHaveAttribute('aria-pressed', 'true');
  await expect(position).toContainText('Ходов: 3');
  await direction('К игре').click();
  await undo.click();
  await expect(position).toContainText('столбец 3, ряд 3 · Ходов: 2');
  await expect(phrase).not.toContainText('cat');
  await page.setViewportSize(landscape[0]!);
  // Move the plaque onto the bottom-left cell where the up arrow overlays it.
  const toCorner = [
    'ArrowRight',
    'ArrowUp',
    'ArrowLeft',
    'ArrowUp',
    'ArrowLeft',
    'ArrowDown',
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
  ];
  for (const key of toCorner) await field(page).press(key);
  await expect(position).toContainText('столбец 2, ряд 3 · Ходов: 11');
  await direction('Слушать слова на поле').click();
  const cat = wordOnField(page, 'cat');
  const catBox = (await cat.boundingBox())!;
  const up = (await direction('Вверх').boundingBox())!;
  expect(catBox.x).toBeLessThan(up.x + up.width);
  expect(catBox.x + catBox.width).toBeGreaterThan(up.x);
  expect(catBox.y + catBox.height).toBeGreaterThan(up.y);
  await cat.click();
  await expect(page.locator('.listening-bar')).toContainText(
    'Можно послушать ещё раз',
    { timeout: 6000 },
  );
  await page.screenshot({
    path: info.outputPath('workshop-listening-568x320.png'),
  });
  await expect(position).toContainText('Ходов: 11');
  await direction('К игре').click();
  for (let index = 0; index < toCorner.length; index++)
    await field(page).press('KeyZ');
  await expect(position).toContainText('столбец 3, ряд 3 · Ходов: 2');
  await direction('Вверх').click();
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(talk(page)).toContainText('Первая просьба выполнена');
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('seven-column level fits wide landscape and the narrow frame', async ({
  page,
}, info) => {
  await page.setViewportSize(landscape[0]!);
  await unlockEgg(page);
  await finishTalk(page, 'Начать просьбу');
  await expect(field(page)).toHaveAttribute('data-columns', '7');
  await expect(field(page)).toHaveAttribute('data-rows', '4');

  for (const viewport of [...landscape, narrowFrame]) {
    await page.setViewportSize(viewport);
    const space = page.locator('.landscape-board-space');
    await expect(space).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.phrase-action')).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: info.outputPath(`egg-${viewport.width}x${viewport.height}.png`),
    });
  }
});
