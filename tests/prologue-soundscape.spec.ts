import { expect, test, type Page } from '@playwright/test';

type Probe = {
  sources: { node: AudioBufferSourceNode; active: boolean; offset: number }[];
};
declare global {
  interface Window {
    soundscapeProbe: Probe;
  }
}

// Observe real browser decoding and source lifetimes, without replacing playback.
async function observe(page: Page) {
  await page.addInitScript(() => {
    window.soundscapeProbe = { sources: [] };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = create.call(this);
      const entry = { node, active: false, offset: 0 };
      window.soundscapeProbe.sources.push(entry);
      const start = node.start.bind(node);
      const stop = node.stop.bind(node);
      node.start = (when, offset, duration) => {
        entry.active = true;
        entry.offset = offset ?? 0;
        start(when, offset, duration);
      };
      node.stop = (when) => {
        entry.active = false;
        stop(when);
      };
      node.addEventListener('ended', () => {
        entry.active = false;
      });
      return node;
    };
  });
}
const active = (page: Page) =>
  page.evaluate(
    () =>
      window.soundscapeProbe.sources.filter(
        (s) => s.active && (s.node.buffer?.duration ?? 0) > 50,
      ).length,
  );
const video = (page: Page) => page.locator('.prologue-film video');
const resume = (page: Page) =>
  page.getByRole('button', { name: /^(Смотреть историю|Продолжить)$/ });
async function open(page: Page) {
  await observe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать путешествие' }).click();
  await resume(page).click();
}

test('background buses are independent, seek with the film and stop on exit', async ({
  page,
}) => {
  await open(page);
  await expect.poll(() => active(page)).toBe(2);
  await page.keyboard.press('Escape');
  await expect.poll(() => active(page)).toBe(0);
  await page.getByRole('checkbox', { name: 'Музыка', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Голос рассказчика' }).uncheck();
  await resume(page).click();
  await expect.poll(() => active(page)).toBe(1);
  expect(await video(page).evaluate((v: HTMLVideoElement) => v.muted)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', { name: 'Музыка', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Звуки окружения' }).uncheck();
  await video(page).evaluate((v: HTMLVideoElement) => {
    v.currentTime = 30;
  });
  await resume(page).click();
  await expect.poll(() => active(page)).toBe(1);
  expect(
    await page.evaluate(() =>
      window.soundscapeProbe.sources
        .filter((s) => s.active && (s.node.buffer?.duration ?? 0) > 50)
        .every((s) => s.offset >= 30 && s.node.buffer?.numberOfChannels === 2),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(resume(page)).toBeDisabled();
  await expect.poll(() => active(page)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(resume(page)).toBeEnabled();
  expect(await active(page)).toBe(0);
  await resume(page).click();
  await expect.poll(() => active(page)).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Пропустить пролог' }).click();
  await expect(video(page)).toHaveCount(0);
  await expect.poll(() => active(page)).toBe(0);
  expect(
    await page.evaluate(() =>
      window.soundscapeProbe.sources
        .filter((s) => (s.node.buffer?.duration ?? 0) > 50)
        .every((s) => s.node.context.state === 'closed'),
    ),
  ).toBe(true);
});

test('late background downloads cannot start after leaving the film', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests = new Set<string>();
  let pending = 0;
  await page.route(
    /\/audio\/prologue\/(music|effects)-v1\.mp3/,
    async (route) => {
      requests.add(route.request().url());
      pending++;
      try {
        await gate;
        await route.continue();
      } finally {
        pending--;
      }
    },
  );
  try {
    await open(page);
    await expect.poll(() => requests.size).toBe(2);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Пропустить пролог' }).click();
    await expect(video(page)).toHaveCount(0);
    release();
    await expect.poll(() => pending).toBe(0);
    await expect(
      page.getByRole('region', { name: 'Разговор с котом' }),
    ).toBeVisible();
    expect(await active(page)).toBe(0);
  } finally {
    release();
  }
});

test('host pause and closed stop both decoded background buses', async ({
  page,
}) => {
  await observe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tests/fixtures/host.html');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Начать путешествие' }).click();
  const resumeButton = frame.getByRole('button', {
    name: /^(Смотреть историю|Продолжить)$/,
  });
  const count = () =>
    frame
      .locator('body')
      .evaluate(
        () =>
          window.soundscapeProbe.sources.filter(
            (s) => s.active && (s.node.buffer?.duration ?? 0) > 50,
          ).length,
      );
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
  await resumeButton.click();
  await expect.poll(count).toBe(2);
  await send('paused');
  await expect(resumeButton).toBeDisabled();
  await expect.poll(count).toBe(0);
  await send('resumed');
  await expect(resumeButton).toBeEnabled();
  expect(await count()).toBe(0);
  await resumeButton.click();
  await expect.poll(count).toBe(2);
  await send('closed');
  await expect(resumeButton).toBeDisabled();
  await expect.poll(count).toBe(0);
});

test('missing ambience keeps the music, narration and automatic transition working', async ({
  page,
}) => {
  await page.route('**/audio/prologue/effects-v1.mp3', (route) =>
    route.abort(),
  );
  await open(page);
  await expect.poll(() => active(page)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status')).toContainText(
    'Часть фоновых звуков недоступна',
  );
  expect(await video(page).evaluate((v: HTMLVideoElement) => v.muted)).toBe(
    false,
  );
  await video(page).evaluate((v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.3;
  });
  await resume(page).click();
  await expect(
    page.getByRole('region', { name: 'Разговор с котом' }),
  ).toBeVisible();
  await expect.poll(() => active(page)).toBe(0);
});
