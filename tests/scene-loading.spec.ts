import { expect, test, type Page } from '@playwright/test';

const workshopInterior = '**/room-v1.webp';
const workshopArt = '**/art/**/*.webp';

async function enterHostedWorkshop(page: Page) {
  await page.goto('/tests/fixtures/host.html');
  const game = page.frameLocator('iframe[title="Test game"]');
  await game.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  return {
    game,
    field: game.getByRole('group', { name: /^Игровое поле/ }),
    talk: game.getByRole('region', { name: 'Разговор с котом' }),
    move: game.getByRole('button', { name: 'Вверх', exact: true }),
  };
}

test('the first room waits only for its own artwork', async ({
  page,
}, info) => {
  const requested = new Set<string>();
  let resume = () => {};
  const hold = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route(workshopArt, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (route.request().resourceType() === 'fetch') requested.add(pathname);
    if (pathname.includes('/station/')) return route.abort();
    if (
      pathname.endsWith('/room-v1.webp') &&
      route.request().resourceType() === 'fetch'
    )
      await hold;
    return route.continue();
  });
  const { game, field, talk, move } = await enterHostedWorkshop(page);
  try {
    await talk.getByRole('button', { name: 'Дальше', exact: true }).click();
    await talk.getByRole('button', { name: 'Сделать первый шаг' }).click();
    await expect(game.getByText('Загружаем мастерскую…')).toBeVisible();
    await expect(field).toHaveAttribute('aria-busy', 'true');
    await expect(field.locator('canvas')).toBeHidden();
    await expect(move).toBeDisabled();
    await expect(
      game.getByRole('button', { name: 'Меню и пауза' }),
    ).toBeEnabled();
    await page.screenshot({ path: info.outputPath('loading.png') });
  } finally {
    resume();
  }
  await expect(field).toHaveAttribute('data-scene-state', 'ready');
  await expect(field.locator('canvas')).toBeVisible();
  await expect(move).toBeEnabled();
  expect([...requested].sort()).toEqual([
    '/art/lantern-and-moss/foreground-v1.webp',
    '/art/lantern-and-moss/forest-v1.webp',
    '/art/lantern-and-moss/room-v1.webp',
    '/art/lumi/cat-emotes-v1.webp',
    '/art/lumi/cat-v1.webp',
    '/art/lumi/lumi-emotes-v1.webp',
    '/art/lumi/lumi-v1.webp',
  ]);
  await page.screenshot({ path: info.outputPath('ready.png') });
});

test('transient HTTP and connection errors recover automatically', async ({
  page,
}) => {
  let attempts = 0;
  await page.route(workshopInterior, (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503 });
    if (attempts === 2) return route.abort('internetdisconnected');
    return route.continue();
  });
  const { game, field } = await enterHostedWorkshop(page);
  await expect(field).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15_000,
  });
  expect(attempts).toBe(3);
  await expect(game.getByRole('alert')).toHaveCount(0);
});

test('retry keeps the conversation and only requests the failed image', async ({
  page,
}, info) => {
  const requested = new Map<string, number>();
  let recovered = false;
  await page.route(workshopArt, (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    const { pathname } = new URL(route.request().url());
    requested.set(pathname, (requested.get(pathname) ?? 0) + 1);
    if (pathname.endsWith('/room-v1.webp') && !recovered)
      return route.fulfill({ status: 503 });
    return route.continue();
  });
  const { game, field, talk, move } = await enterHostedWorkshop(page);
  await talk.getByRole('button', { name: 'Дальше', exact: true }).click();
  const line = await talk.locator('.cat-line').innerText();
  const retry = game.getByRole('button', { name: 'Повторить загрузку' });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  await expect(game.getByRole('alert')).toHaveText('Сцена не загрузилась');
  await expect(field.locator('canvas')).toBeHidden();
  await page.screenshot({ path: info.outputPath('error.png') });
  expect(requested.get('/art/lantern-and-moss/room-v1.webp')).toBe(3);
  recovered = true;
  await retry.press('Enter');
  await expect(field).toHaveAttribute('data-scene-state', 'ready');
  await expect(field).toBeFocused();
  await expect(talk.locator('.cat-line')).toHaveText(line);
  await talk.getByRole('button', { name: 'Сделать первый шаг' }).click();
  await expect(move).toBeEnabled();
  expect(requested.size).toBe(7);
  for (const [path, attempts] of requested)
    expect(attempts).toBe(path.endsWith('/room-v1.webp') ? 4 : 1);
});

test('leaving for the menu interrupts downloads and keeps the same canvas', async ({
  page,
}) => {
  let attempts = 0;
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(workshopInterior, async (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    attempts++;
    if (attempts === 1) {
      await hold;
      return route.abort();
    }
    return route.continue();
  });
  try {
    const { game, field, talk } = await enterHostedWorkshop(page);
    await expect.poll(() => attempts).toBe(1);
    const canvas = await field.locator('canvas').elementHandle();
    const previousLine = await talk.locator('.cat-line').innerText();
    await game.getByRole('button', { name: 'Меню и пауза' }).click();
    await game.getByRole('button', { name: 'В главное меню' }).click();
    await game.getByRole('button', { name: 'Продолжить путешествие' }).click();
    await expect(field).toHaveAttribute('data-scene-state', 'ready', {
      timeout: 15_000,
    });
    await expect(talk.locator('.cat-line')).toHaveText(previousLine);
    expect(attempts).toBe(2);
    expect(await canvas?.evaluate((node) => node.isConnected)).toBe(true);
    await expect(field.locator('canvas')).toHaveCount(1);
  } finally {
    release();
  }
});
