import { expect, test, type Locator } from '@playwright/test';
import { field, finishTalk } from './helpers/workshop';

async function exposed(control: Locator) {
  expect(
    await control.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width >= 44 &&
        r.height >= 44 &&
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        r.left >= 0 &&
        r.right <= innerWidth &&
        el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        )
      );
    }),
  ).toBe(true);
}

test('pause branches preserve puzzle, trap focus and return; reset requires deliberate confirmation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready');
  await field(page).press('ArrowLeft');
  const before = await page.locator('.sr-only').textContent();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: /^Настройки/ }).click();
  await page
    .getByRole('checkbox', { name: 'Голоса персонажей', exact: true })
    .uncheck();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', 'Пауза');
  await page.getByRole('button', { name: /^Дорожный журнал/ }).click();
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('WASD');
  await page
    .getByRole('button', { name: 'Послушать слова', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Назад в журнал', exact: false }),
  ).toBeVisible();
  for (let i = 0; i < 22; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        // Native dialogs may yield focus to browser chrome (body is then active),
        // but must never Tab into the inert game controls behind the dialog.
        () =>
          document.activeElement === document.body ||
          !!document.activeElement?.closest('dialog[open]'),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveAttribute(
    'aria-label',
    'Дорожный журнал',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute(
    'aria-label',
    'Начать заново?',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Отмена', exact: true })
    .click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(field(page)).toBeFocused();
  await expect(page.locator('.sr-only')).toHaveText(before!);
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: /^Настройки/ }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Голоса персонажей', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Закрыть настройки' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page
    .getByRole('button', { name: 'Начать эпизод заново', exact: true })
    .click();
  await expect(page.locator('.sr-only')).toContainText('Ходов: 0');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('dialog')
    .evaluate((el) => (el as HTMLDialogElement).close());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(field(page)).toBeFocused();
});

test('menu and large dictionary remain usable in short landscape, portrait and enlarged text', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto('/tests/fixtures/menu.html');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  for (const [width, height] of [
    [1280, 720],
    [800, 360],
    [568, 320],
    [360, 800],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.getByRole('button', { name: 'Меню и пауза' }).click();
    const dialog = page.getByRole('dialog');
    for (const name of ['Продолжить', 'Закрыть меню', 'Настройки'])
      await exposed(
        dialog.getByRole('button', { name: new RegExp(`^${name}`) }),
      );
    await page.screenshot({ path: info.outputPath(`menu-${width}.png`) });
    await dialog.getByRole('button', { name: /^Слова и произношение/ }).click();
    const nav = dialog.getByRole('navigation', { name: 'Выбрать слово' });
    expect(await nav.getByRole('button').count()).toBeGreaterThan(20);
    await dialog.getByRole('searchbox', { name: 'Найти слово' }).fill('ключ');
    await expect(
      nav.getByRole('button', { name: 'key', exact: true }),
    ).toBeVisible();
    await nav.getByRole('button', { name: 'key', exact: true }).click();
    await expect(
      dialog.getByRole('heading', { name: 'key', exact: true }),
    ).toBeVisible();
    await dialog.getByRole('searchbox').fill('неттакогослова');
    await expect(
      dialog.getByRole('status').filter({ hasText: 'Такого слова' }),
    ).toBeVisible();
    await dialog.getByRole('searchbox').fill('');
    await page.screenshot({ path: info.outputPath(`words-${width}.png`) });
    await exposed(dialog.getByRole('button', { name: 'Закрыть слова' }));
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await dialog.getByRole('button', { name: 'Закрыть слова' }).click();
  }
  await page.addStyleTag({ content: 'html {font-size: 200%}' });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await exposed(page.getByRole('button', { name: 'Закрыть меню' }));
  await page.getByRole('button', { name: /^Настройки/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('checkbox', { name: 'Голоса персонажей', exact: true }),
  ).toBeVisible();
  await exposed(dialog.getByRole('button', { name: 'Закрыть настройки' }));
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('settings-large-text.png') });
});
