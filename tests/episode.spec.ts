import { expect, test, type Page } from '@playwright/test';

const field = (page: Page) =>
  page.getByRole('group', { name: /^Игровое поле/ });
const position = (page: Page) => page.locator('.sr-only');
const conversation = (page: Page) =>
  page.getByRole('region', { name: 'Разговор с котом' });
async function finishTalk(page: Page, action: string) {
  while (
    await conversation(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  )
    await conversation(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
  await conversation(page)
    .getByRole('button', { name: action, exact: true })
    .click();
}
async function meet(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await expect(conversation(page)).toContainText('почтовый фонарь');
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await expect(field(page)).toBeFocused();
}
async function start(page: Page) {
  await meet(page);
  await page.keyboard.press('KeyD');
  await expect(conversation(page)).toContainText('Первая просьба');
  await finishTalk(page, 'Попробовать');
}
async function reset(page: Page) {
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
}

test('meet Lumi, learn movement, solve and undo without manual focus', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await meet(page);
  await page.screenshot({ path: info.outputPath('first-step.png') });
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Вправо', exact: true }).tap();
  else await page.keyboard.press('KeyD');
  await finishTalk(page, 'Попробовать');
  await expect(field(page)).toBeFocused();
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Влево', exact: true }).tap();
    await page.getByRole('button', { name: 'Вверх', exact: true }).tap();
    await page.getByRole('button', { name: /Передать просьбу/ }).tap();
  } else {
    await page.keyboard.press('KeyA');
    await page.keyboard.press('KeyW');
    await page.keyboard.press('Enter');
  }
  await expect(
    page.getByRole('heading', { name: 'Первая просьба выполнена' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Вернуться к полю', exact: true })
    .click();
  await page.screenshot({ path: info.outputPath('workshop-success.png') });
  await page.keyboard.press('KeyZ');
  await expect(
    page.getByRole('button', { name: /Передать просьбу/ }),
  ).toBeEnabled();
  await page.keyboard.press('KeyZ');
  await expect(position(page)).toContainText('столбец 3, ряд 3 · Ходов: 2');
  await reset(page);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Начать эпизод заново…' }).click();
  await page
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
  await expect(position(page)).toContainText('Ходов: 0');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('journal, hint, pause, replay and keyboard boundaries preserve the board', async ({
  page,
}) => {
  await start(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('ещё не собрано');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByText('Управление', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('русской раскладке');
  await page.keyboard.press('KeyW');
  await expect(position(page)).toContainText('Ходов: 1');
  await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('cat');
  await expect(field(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', 'Пауза');
  await page.keyboard.press('ArrowLeft');
  await expect(position(page)).toContainText('Ходов: 1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /^Настройки/ }).click();
  await page.getByRole('button', { name: 'Пересмотреть пролог' }).click();
  await page.getByRole('button', { name: 'Пропустить пролог' }).click();
  await expect(field(page)).toBeFocused();
  await expect(position(page)).toContainText('столбец 4, ряд 3 · Ходов: 1');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('Tab');
  await expect(field(page)).not.toBeFocused();
  await page.keyboard.press('KeyW');
  await expect(position(page)).toContainText('Ходов: 2');
  await page.locator('canvas').click();
  // Physical W with a Russian-layout key value.
  await field(page).dispatchEvent('keydown', { code: 'KeyW', key: 'ц' });
  await expect(position(page)).toContainText('ряд 2 · Ходов: 3');
  await page.keyboard.press('KeyZ');
  await expect(position(page)).toContainText('ряд 3 · Ходов: 2');
});

test('touch swipe moves once; tap, diagonal and cancellation do not move', async ({
  page,
}) => {
  await start(page);
  await reset(page);
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('No canvas');
  const x = canvas.x + canvas.width / 2,
    y = canvas.y + canvas.height * 0.7;
  const cdp = await page.context().newCDPSession(page);
  const touch = async (
    type: 'touchStart' | 'touchEnd' | 'touchMove' | 'touchCancel',
    points: { x: number; y: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x, y }]);
  await touch('touchEnd', []);
  await expect(position(page)).toContainText('Ходов: 0');
  await touch('touchStart', [{ x, y }]);
  await touch('touchMove', [{ x: x + 40, y: y + 40 }]);
  await touch('touchEnd', []);
  await expect(position(page)).toContainText('Ходов: 0');
  await touch('touchStart', [{ x, y }]);
  await touch('touchMove', [{ x: x + 40, y }]);
  await touch('touchCancel', []);
  await expect(position(page)).toContainText('Ходов: 0');
  await touch('touchStart', [{ x, y }]);
  await touch('touchMove', [{ x, y: y - 60 }]);
  await touch('touchEnd', []);
  await expect(position(page)).toContainText('ряд 2 · Ходов: 1');
  await expect(page.getByLabel('Слова в рамке чтения')).toContainText('cat');
  await page.getByRole('button', { name: 'Отмена', exact: false }).click();
  await expect(position(page)).toContainText('Ходов: 0');
});

test('HUD fits portrait and landscape; large text stays reachable in journal', async ({
  page,
}, info) => {
  await start(page);
  for (const [width, height] of [
    [360, 800],
    [844, 390],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    const canvas = await page.locator('canvas').boundingBox();
    expect(canvas).not.toBeNull();
    for (const name of ['Вверх', 'Влево', 'Вниз', 'Вправо']) {
      const rect = await page
        .getByRole('button', { name, exact: true })
        .boundingBox();
      expect(rect!.width).toBeGreaterThanOrEqual(46);
      expect(rect!.height).toBeGreaterThanOrEqual(46);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(height!);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width!);
    }
    await page.screenshot({ path: info.outputPath(`hud-${width}.png`) });
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByText('Правило и слова', { exact: true }).click();
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(field(page)).toBeFocused();
});

test('portrait dialogue preserves lesson and board through rotation, journal and pause', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await meet(page);
  await page.getByRole('button', { name: 'Вправо', exact: true }).click();
  await conversation(page)
    .getByRole('button', { name: 'Дальше', exact: true })
    .click();
  await expect(conversation(page)).toContainText('неопределённого артикля');
  const text = await page.locator('.cat-line').textContent();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await field(page).focus();
  await page.keyboard.press('KeyW');
  await expect(position(page)).toContainText('Ходов: 1');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByText('Правило и слова', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('исчисляемым');
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await expect(conversation(page)).toBeFocused();
  await expect(page.locator('.cat-line')).toHaveText(text!);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Настройки/ }).click();
  await page.getByRole('button', { name: 'Пересмотреть пролог' }).click();
  if (
    await page.getByRole('button', { name: 'Пауза', exact: true }).isVisible()
  )
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустить пролог' }).click();
  await expect(conversation(page)).toBeFocused();
  await expect(page.locator('.cat-line')).toHaveText(text!);
  for (const [width, height] of [
    [360, 800],
    [667, 375],
    [844, 390],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.locator('.cat-line')).toHaveText(text!);
    await expect
      .poll(async () => {
        const rect = await page.locator('canvas').boundingBox();
        return (
          rect &&
          Math.abs(rect.width - width!) < 2 &&
          Math.abs(rect.height - height!) < 2
        );
      })
      .toBe(true);
    await page.screenshot({
      path: info.outputPath(`cat-dialogue-${width}.png`),
    });
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(
    conversation(page).getByRole('button', { name: 'Дальше', exact: true }),
  ).toBeInViewport();
  await page.locator('.cat-line').focus();
  await page.keyboard.press('End');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await finishTalk(page, 'Попробовать');
  await page.getByRole('button', { name: 'Влево', exact: true }).click();
  await page.getByRole('button', { name: 'Вверх', exact: true }).click();
  await page.getByRole('button', { name: /Передать просьбу/ }).click();
  await expect(conversation(page)).toContainText('Первая просьба выполнена');
  await expect(page.locator('canvas')).toHaveCount(1);
});
