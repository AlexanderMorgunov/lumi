import { expect, test, type Locator } from '@playwright/test';
import { field, finishTalk, talk } from './helpers/workshop';

async function reachable(control: Locator) {
  // Unlike click(), this does not auto-scroll a clipped control into view.
  expect(
    await control.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= innerWidth &&
        r.bottom <= innerHeight &&
        el.contains(
          document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
        )
      );
    }),
  ).toBe(true);
}

test('embedded title menu fits short desktop and phone frames without scrolling', async ({
  page,
}) => {
  for (const [width, height] of [
    [1118, 583],
    [303, 518],
    [333, 547],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto('/');
    const menu = page.locator('.title-screen');
    await expect(menu).toBeVisible();
    expect(
      await menu.evaluate(
        (el) =>
          el.scrollHeight <= el.clientHeight + 1 &&
          el.scrollWidth <= el.clientWidth + 1,
      ),
    ).toBe(true);
    for (const name of [
      'На всё окно',
      'Музыка меню и главы',
      'Звуки игры и меню',
      'Сразу в мастерскую',
    ])
      await reachable(page.getByRole('button', { name, exact: true }));
  }
});

test('short landscape keeps entry actions, dialogue and first-step cue readable', async ({
  page,
}) => {
  for (const [width, height] of [
    [568, 320],
    [640, 360],
    [800, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto('/');
    for (const name of [
      'Начать путешествие',
      'Сразу в мастерскую',
      'Карта фонарей · главы и эпизоды',
    ])
      await reachable(page.getByRole('button', { name, exact: true }));
    await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
    await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
      timeout: 15000,
    });
    expect(
      await page.locator('.cat-line').evaluate((el) => el.clientHeight),
    ).toBeGreaterThanOrEqual(48);
    await reachable(
      talk(page).getByRole('button', { name: 'Дальше', exact: true }),
    );
    await finishTalk(page, 'Сделать первый шаг');
    const overlap = await page.locator('.quest-chip').evaluate((el) => {
      const a = el.getBoundingClientRect();
      return [...document.querySelectorAll('.hud-top button')].some((b) => {
        const r = b.getBoundingClientRect();
        return (
          a.left < r.right &&
          a.right > r.left &&
          a.top < r.bottom &&
          a.bottom > r.top
        );
      });
    });
    expect(overlap).toBe(false);
    await page.getByRole('button', { name: 'Вправо', exact: true }).click();
    await expect(talk(page)).toContainText('Первая просьба');
  }
});

test('scrolled panels always expose close and preserve the board and keyboard return', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 800, height: 360 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [open, close] of [
      ['Журнал', 'Закрыть журнал'],
      ['Слова', 'Закрыть слова'],
      ['Меню и пауза', 'Закрыть меню'],
    ]) {
      await page.getByRole('button', { name: open, exact: true }).click();
      const dialog = page.getByRole('dialog');
      if (open === 'Журнал')
        await dialog.getByText('Правило и слова', { exact: true }).click();
      await dialog.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await reachable(dialog.getByRole('button', { name: close, exact: true }));
      await dialog.getByRole('button', { name: close, exact: true }).click();
      await expect(field(page)).toBeFocused();
      await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
    }
  }
  await page.keyboard.press('KeyD');
  await expect(talk(page)).toContainText('Первая просьба');
});

test('selected dictionary text stays legible under the pointer', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  const word = page.getByRole('button', { name: 'cat', exact: true });
  await word.click();
  await word.hover();
  const contrast = await word.evaluate((el) => {
    const style = getComputedStyle(el);
    const luminance = (value: string) => {
      const [r, g, b] = value
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const n = v / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        });
      return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
    };
    const fg = luminance(style.color),
      bg = luminance(style.backgroundColor);
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await expect(word).toHaveAttribute('aria-pressed', 'true');
});

test('prologue pause actions fit the small landscape viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать путешествие' }).click();
  await reachable(page.getByRole('button', { name: 'Смотреть историю' }));
  await reachable(page.getByRole('button', { name: 'Пропустить пролог' }));
});
