import { expect, test, type Page, type FrameLocator } from '@playwright/test';

async function enterKey(game: Page | FrameLocator) {
  const talk = game.getByRole('region', { name: 'Разговор с котом' });
  async function finish(action: string) {
    while (
      await talk.getByRole('button', { name: 'Дальше', exact: true }).count()
    )
      await talk.getByRole('button', { name: 'Дальше', exact: true }).click();
    await talk.getByRole('button', { name: action, exact: true }).click();
  }
  await finish('Сделать первый шаг');
  const board = game.getByRole('group', { name: /^Игровое поле/ });
  await expect(board).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await board.press('KeyD');
  await finish('Попробовать');
  for (const key of ['KeyA', 'KeyW', 'Enter']) await board.press(key);
  await game.getByRole('button', { name: 'Следующая просьба' }).click();
}

test('dictionary grows on entered requests and keeps earlier words playable', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Словарь игры' });
  const words = panel.getByRole('navigation', { name: 'Выбрать слово' });
  await expect(words.getByRole('button')).toHaveText(['a', 'cat']);
  await panel.getByRole('button', { name: 'Закрыть слова' }).click();
  await enterKey(page);
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await expect(words.getByRole('button')).toHaveText(['a', 'cat', 'key']);
  await words.getByRole('button', { name: 'cat', exact: true }).click();
  await panel
    .getByRole('button', { name: 'Послушать cat', exact: true })
    .click();
  await expect(panel.locator('.word-audio-status')).toContainText(
    /Произносим|Можно послушать/,
  );
  for (const viewport of info.project.name === 'mobile'
    ? [
        { width: 360, height: 800 },
        { width: 800, height: 360 },
      ]
    : [{ width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await panel.getByRole('button', { name: 'В этой просьбе · 2' }).click();
    await expect(words.getByRole('button')).toHaveText(['key', 'a']);
    await expect(
      panel.getByRole('heading', { name: 'key', exact: true }),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Встреченные · 3' }).click();
    await words.getByRole('button', { name: 'cat', exact: true }).click();
    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({
      path: info.outputPath(`word-library-${viewport.width}.png`),
    });
  }
  await panel.getByRole('button', { name: 'Закрыть слова' }).click();
  await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await expect(words.getByRole('button')).toHaveText(['a', 'cat', 'key']);
  await page.reload();
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  // Account progress persistence is not implemented; a fresh run starts at cat.
  await expect(words.getByRole('button')).toHaveText(['a', 'cat']);
});

test('previously encountered words and articles retain confirmed DayEnglish capture', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/host.html');
  const game = page.frameLocator('iframe');
  await game.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await enterKey(game);
  await game.getByRole('button', { name: 'Слова', exact: true }).click();
  const words = game.getByRole('navigation', { name: 'Выбрать слово' });
  await words.getByRole('button', { name: 'cat', exact: true }).click();
  expect(JSON.parse(await page.locator('#requests').innerText())).toHaveLength(
    0,
  );
  await game.getByRole('button', { name: 'Добавить в DayEnglish' }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(
    game.getByRole('button', { name: '✓ В словаре DayEnglish' }),
  ).toBeDisabled();
  await words.getByRole('button', { name: 'a', exact: true }).click();
  await game.getByRole('button', { name: 'Добавить в DayEnglish' }).click();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(game.locator('.capture-word')).toContainText(
    'Добавление отменено',
  );
  await expect(
    game.getByRole('button', { name: 'Добавить в DayEnglish' }),
  ).toBeEnabled();
  const requests = JSON.parse(await page.locator('#requests').innerText());
  expect(requests).toHaveLength(2);
  expect(requests[0].payload).toMatchObject({
    term: 'cat',
    translation: 'кот / кошка',
    context: expect.stringContaining('Словарь игры · cat'),
  });
  expect(requests[1].payload).toMatchObject({
    term: 'a',
    translation: 'неопределённый артикль перед согласным звуком',
  });
  await words.getByRole('button', { name: 'cat', exact: true }).click();
  await expect(
    game.getByRole('button', { name: '✓ В словаре DayEnglish' }),
  ).toBeDisabled();
});
