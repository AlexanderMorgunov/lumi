import { expect, test } from '@playwright/test';
import { field, finishTalk } from './helpers/workshop';

test('title opens the road directly; preview preserves the hero and does not unlock lessons', async ({
  page,
}) => {
  await page.goto('/');
  const entry = page.getByRole('button', {
    name: 'Карта фонарей · главы и эпизоды',
  });
  await entry.click();
  await expect(page.locator('.cinematic')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  const current = page.getByRole('button', { name: /^Эпизод 1:/ });
  await expect(current).toHaveAttribute('aria-current', 'step');
  await expect(current).toHaveClass(/available/);
  await expect(page.locator('.lantern-stop.completed')).toHaveCount(0);
  await expect(page.locator('.episode-preview')).toHaveCount(0);
  await page.getByRole('button', { name: /^Эпизод 2:/ }).click();
  await expect(
    page.getByRole('button', { name: /^Эпизод 2:/ }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(current).toHaveAttribute('aria-current', 'step');
  await expect(
    page.getByRole('button', { name: 'Эпизод пока закрыт' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Эпизод 2:/ })).toBeFocused();
  await expect(
    page.getByRole('dialog', { name: 'Карта фонарей', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Глава путешествия').selectOption('1');
  await page.getByLabel('Глава путешествия').selectOption('0');
  await page.getByRole('button', { name: 'К фонарю Люми' }).click();
  await expect(
    page.getByRole('heading', { name: 'Первая просьба', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Закрыть описание эпизода' }).click();
  await page.getByLabel('Глава путешествия').selectOption('1');
  await expect(
    page.getByText('Путь откроется после финала мастерской'),
  ).toBeVisible();
  await expect(page.locator('.overview-heading')).toContainText(
    'am / is / are',
  );
  await page.getByLabel('Глава путешествия').selectOption('0');
  await page.keyboard.press('Escape');
  await expect(entry).toBeFocused();
  await entry.click();
  await page.getByRole('button', { name: /^Эпизод 1:/ }).click();
  await page
    .getByRole('button', { name: 'Продолжить эпизод', exact: true })
    .click();
  await expect(page.locator('.cinematic')).toHaveCount(0);
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('lit progress, current room and conversation survive main menu and road navigation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.keyboard.press('KeyD');
  await finishTalk(page, 'Попробовать');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyW');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'В главное меню', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Продолжить путешествие' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(page.locator('.lantern-stop.completed')).toHaveCount(1);
  await page.getByRole('button', { name: /^Эпизод 2:/ }).click();
  await page.getByRole('button', { name: 'Перейти к эпизоду' }).click();
  await expect(page.locator('.workshop')).toHaveAttribute(
    'data-episode',
    'key',
  );
  await expect(page.locator('.cinematic')).toHaveCount(0);
  await finishTalk(page, 'Начать просьбу');
  await field(page).focus();
  await page.keyboard.press('KeyA');
  const positionText = page.locator('.workshop > .sr-only');
  await expect(positionText).toContainText('Ходов: 1.');
  const position = await positionText.textContent();
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'В главное меню', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(
    page.getByRole('button', { name: /^Эпизод 2:/ }),
  ).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: /^Эпизод 1:/ }).click();
  await page.getByRole('button', { name: 'Закрыть описание эпизода' }).click();
  await page.getByRole('button', { name: 'К фонарю Люми' }).click();
  await page
    .getByRole('button', { name: 'Продолжить эпизод', exact: true })
    .click();
  await expect(positionText).toHaveText(position!);
  await expect(field(page)).toBeFocused();
  expect(await canvas?.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);
});
