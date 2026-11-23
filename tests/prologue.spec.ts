import { expect, test, type Page } from '@playwright/test';
import film from '../src/app/prologue-film.json' with { type: 'json' };

const movie = (page: Page) => page.locator('.prologue-film video');
const continueButton = (page: Page) =>
  page.getByRole('button', { name: /^(Смотреть историю|Продолжить)$/ });
async function openPaused(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать путешествие' }).click();
  await expect
    .poll(() => movie(page).evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
}
async function hidden(page: Page, value: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

test('cinematic has a pause menu and ends directly in the workshop', async ({
  page,
}, info) => {
  await openPaused(page);
  const video = movie(page);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await expect(continueButton(page)).toBeFocused();
  await expect(page.getByRole('slider')).toHaveCount(0);
  await continueButton(page).click();
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 33;
  });
  await expect(page.locator('.film-caption')).toContainText('За его стеклом');
  await expect(page.locator('.prologue-film button:visible')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('cutscene-watch.png') });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Пауза пролога' }),
  ).toBeVisible();
  await expect(continueButton(page)).toBeFocused();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('cutscene-pause.png') });
  await page.getByRole('checkbox', { name: 'Субтитры', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Голос рассказчика' }).uncheck();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.muted))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.film-caption')).toHaveCount(0);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Субтитры', exact: true }).check();
  await page.getByRole('button', { name: 'Текст истории' }).click();
  await expect(page.locator('.cutscene-story')).toContainText(
    'смотрителя далёкого маяка',
  );
  await page.keyboard.press('Escape');
  await expect(continueButton(page)).toBeVisible();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await continueButton(page).click();
  await hidden(page, true);
  await expect(continueButton(page)).toBeDisabled();
  await hidden(page, false);
  await expect(continueButton(page)).toBeEnabled();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  const handle = await video.elementHandle();
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.2;
  });
  await continueButton(page).click();
  await expect(
    page.getByRole('region', { name: 'Разговор с котом' }),
  ).toContainText('Просыпайся, Люми');
  await expect(
    page.getByRole('button', { name: 'В мастерскую', exact: true }),
  ).toHaveCount(0);
  expect(
    await handle?.evaluate(
      (v: HTMLVideoElement) => v.paused && !v.getAttribute('src'),
    ),
  ).toBe(true);
});

test('normal motion autoplays without a media toolbar; Space opens pause', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать путешествие' }).click();
  await expect
    .poll(() => movie(page).evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Вступление' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('dialog', { name: 'Пауза пролога' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Пропустить пролог' }).click();
  await expect(
    page.getByRole('region', { name: 'Разговор с котом' }),
  ).toBeVisible();
});

test('video failure leaves the full story and a route into the game', async ({
  page,
}) => {
  await page.route('**/video/prologue-v1.mp4', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать путешествие' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Не удалось загрузить ролик',
  );
  await expect(page.locator('.cutscene-story')).toContainText(film.story[4]!);
  await page.getByRole('button', { name: 'Продолжить игру' }).click();
  await expect(
    page.getByRole('region', { name: 'Разговор с котом' }),
  ).toBeVisible();
});

test('a delayed video load cannot restart a scene stopped by visibility', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route('**/video/prologue-v1.mp4', async (route) => {
    requested = true;
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Начать путешествие' }).click();
    await expect.poll(() => requested).toBe(true);
    await hidden(page, true);
    await expect(continueButton(page)).toBeDisabled();
    await hidden(page, false);
    release();
    await expect
      .poll(() => movie(page).evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(2);
    await expect(continueButton(page)).toBeEnabled();
    await expect
      .poll(() => movie(page).evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(true);
    await continueButton(page).click();
    await expect
      .poll(() => movie(page).evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(false);
  } finally {
    release();
  }
});

test('host pause and close stop the film without automatic resume', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tests/fixtures/host.html');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Начать путешествие' }).click();
  const video = frame.locator('.prologue-film video');
  const resume = frame.getByRole('button', {
    name: /^(Смотреть историю|Продолжить)$/,
  });
  await resume.click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  const send = (type: string) =>
    page.evaluate((eventType) => {
      document.querySelector('iframe')!.contentWindow!.postMessage(
        {
          channel: 'dayenglish.game',
          version: 1,
          launchId: 'fixture-launch',
          type: 'event',
          event: { type: eventType },
        },
        location.origin,
      );
    }, type);
  await send('paused');
  await expect(resume).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await send('resumed');
  await expect(resume).toBeEnabled();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await resume.click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  await send('closed');
  await expect(resume).toBeDisabled();
  await expect(
    frame.getByRole('button', { name: 'Пропустить пролог' }),
  ).toBeDisabled();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
});

test('landscape cinematic preserves composition and keeps the pause menu reachable', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 800, height: 360 });
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.mp4')) requests.push(r.url());
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Начать путешествие' }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await openPaused(page);
  await continueButton(page).click();
  await movie(page).evaluate((v: HTMLVideoElement) => {
    v.currentTime = 3;
  });
  await expect(page.locator('.film-caption')).toContainText('В Долине огней');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fonts.check('500 18px Lora', 'Долина огней'),
      ),
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath('cutscene-landscape.png') });
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.screenshot({
    path: info.outputPath('cutscene-landscape-menu.png'),
  });
  for (const button of await page
    .locator('.cutscene-menu button:visible')
    .all())
    await expect(button).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
