import { test, expect, type Page } from '@playwright/test';
import { field } from './helpers/workshop';
import {
  createPuzzle,
  reducePuzzle,
  type Direction,
} from '../src/domain/puzzle';
import { solveStation } from './helpers/solve-station';

const talk = (page: Page) => page.locator('.cat-dialogue');
async function finish(page: Page) {
  while (
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  )
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
  await talk(page).locator('.cat-actions button.primary').click();
}
async function enter(page: Page, episode: number) {
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page.getByLabel('Глава путешествия').selectOption('1');
  await page
    .getByRole('button', { name: new RegExp(`^Эпизод ${episode}:`) })
    .click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 30000,
  });
  await finish(page);
}
async function solve(page: Page, route: Direction[]) {
  await field(page).focus();
  for (const direction of route)
    await page.keyboard.press(
      {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      }[direction],
    );
  await page.keyboard.press('Enter');
}
test('replay needs confirmation; cancel preserves the part and success dialogue', async ({
  page,
}, info) => {
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 800, height: 360 });
  await enter(page, 6);
  await solve(page, [
    ...solveStation(createPuzzle('chapter-02-06'), ['I', 'am', 'Lumi']),
  ]);
  await finish(page);
  await finish(page);
  let state = createPuzzle('chapter-02-06');
  for (const direction of solveStation(
    state,
    state.definition.answers[0]!.words,
  ))
    state = reducePuzzle(state, { type: 'move', direction });
  state = reducePuzzle(reducePuzzle(state, { type: 'apply' }), {
    type: 'continue',
  });
  await solve(page, [
    ...solveStation(state, state.definition.answers[0]!.words),
  ]);
  await expect(field(page)).toHaveAttribute(
    'data-level-id',
    'chapter-02-06-you',
  );
  await talk(page)
    .getByRole('button', { name: 'Начать эпизод заново…' })
    .click();
  const confirm = page.getByRole('dialog', { name: 'Начать заново?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(field(page)).toHaveAttribute(
    'data-level-id',
    'chapter-02-06-you',
  );
  await expect(talk(page)).toBeVisible();
  await talk(page)
    .getByRole('button', { name: 'Начать эпизод заново…' })
    .click();
  await confirm
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-06');
});
test('object captions stay readable outside the canvas across narrow sizes', async ({
  page,
}, info) => {
  await enter(page, 10);
  for (const [width, height] of [
    [1440, 900],
    [800, 360],
    [568, 320],
    [360, 800],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const captions = page.getByLabel('Предметы на сцене');
    await expect(captions).toContainText('один ребёнок');
    await expect(captions).toContainText('два ребёнка');
    await expect(captions).toBeInViewport();
    expect(
      await captions.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
    ).toBeGreaterThanOrEqual(14);
    await page.screenshot({ path: info.outputPath(`captions-${width}.png`) });
  }
});
