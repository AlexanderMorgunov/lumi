import { expect, test, type Page } from '@playwright/test';
import { field, talk } from './helpers/workshop';

declare global {
  interface Window {
    musicProbe: {
      player: HTMLMediaElement;
      context: AudioContext;
      gain?: GainNode;
    }[];
  }
}
async function observe(page: Page) {
  await page.addInitScript(() => {
    window.musicProbe = [];
    const create = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (player) {
      const node = create.call(this, player);
      window.musicProbe.push({ player, context: this });
      return node;
    };
    const gain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const node = gain.call(this);
      const entry = window.musicProbe.find((p) => p.context === this);
      if (entry) entry.gain = node;
      return node;
    };
  });
}
const read = (page: Page) =>
  page.evaluate(() => {
    const entry = window.musicProbe.at(-1);
    return {
      count: window.musicProbe.length,
      src: entry?.player.src ?? '',
      playing: !!entry && !entry.player.paused && entry.player.readyState >= 3,
      time: entry?.player.currentTime ?? 0,
      gain: entry?.gain?.gain.value ?? 0,
    };
  });
async function playing(page: Page, file: string) {
  await expect
    .poll(
      async () => {
        const s = await read(page);
        return s.playing && s.src.includes(file);
      },
      { timeout: 15000 },
    )
    .toBe(true);
}

test('menu and lantern map share one music timeline, mute and loop', async ({
  page,
}, info) => {
  await observe(page);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/audio/game-music/')) requests.push(r.url());
  });
  await page.goto('/');
  expect((await read(page)).count).toBe(0);
  expect(requests).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await playing(page, 'the-road-is-sleeping');
  await page.evaluate(() => {
    window.musicProbe[0]!.player.currentTime = 40;
  });
  await page
    .getByRole('button', { name: 'В главное меню', exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).time)
    .toBeGreaterThanOrEqual(40);
  expect((await read(page)).count).toBe(1);
  const toggle = page.getByRole('button', { name: 'Музыка меню и главы' });
  await toggle.click();
  await expect.poll(async () => (await read(page)).playing).toBe(false);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await playing(page, 'the-road-is-sleeping');
  await page.evaluate(() => {
    const p = window.musicProbe[0]!.player;
    p.currentTime = p.duration - 0.2;
  });
  await expect.poll(async () => (await read(page)).time).toBeLessThan(5);
  await playing(page, 'the-road-is-sleeping');
  for (const size of info.project.name === 'mobile'
    ? [
        { width: 360, height: 800 },
        { width: 800, height: 360 },
      ]
    : [{ width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await expect(toggle).toBeInViewport();
    await expect(
      page.getByRole('button', { name: 'Звуки игры и меню' }),
    ).toBeInViewport();
    await page.screenshot({
      path: info.outputPath(`title-audio-${size.width}.png`),
    });
  }
});

test('workshop music ducks under the cat, map switches tracks and prologue stops it', async ({
  page,
}) => {
  await observe(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await playing(page, 'martas-workshop');
  await expect.poll(async () => (await read(page)).gain).toBeLessThan(0.2);
  await talk(page)
    .getByRole('button', { name: 'Голос кота', exact: true })
    .click();
  await expect.poll(async () => (await read(page)).gain).toBeGreaterThan(0.6);
  await page.evaluate(() => {
    window.musicProbe[0]!.player.currentTime = 30;
  });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await playing(page, 'the-road-is-sleeping');
  await page.getByRole('button', { name: 'Вернуться к игре' }).click();
  await playing(page, 'martas-workshop');
  expect((await read(page)).time).toBeGreaterThanOrEqual(30);
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: /^Настройки/ }).click();
  const toggle = page.getByRole('checkbox', { name: 'Музыка меню и главы' });
  await toggle.uncheck();
  await expect.poll(async () => (await read(page)).playing).toBe(false);
  await expect(
    page.getByRole('checkbox', { name: 'Звуки игры и меню' }),
  ).toBeChecked();
  await toggle.check();
  await playing(page, 'martas-workshop');
  await page.getByRole('button', { name: 'Пересмотреть пролог' }).click();
  await expect.poll(async () => (await read(page)).playing).toBe(false);
});

test('station has its own music, returns from map at the saved time and respects mute', async ({
  page,
}) => {
  await observe(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await playing(page, 'the-road-is-sleeping');
  await page.getByRole('button', { name: /^Эпизод 15:/ }).click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await playing(page, 'letters-in-the-rain');
  await page.evaluate(() => {
    window.musicProbe[0]!.player.currentTime = 25;
  });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await playing(page, 'the-road-is-sleeping');
  await page.getByRole('button', { name: 'Вернуться к игре' }).click();
  await playing(page, 'letters-in-the-rain');
  expect((await read(page)).time).toBeGreaterThanOrEqual(25);
  expect((await read(page)).count).toBe(1);
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: /^Настройки/ }).click();
  await page.getByRole('checkbox', { name: 'Музыка меню и главы' }).uncheck();
  await expect.poll(async () => (await read(page)).playing).toBe(false);
});

test('host and visibility pauses stop streamed music; closed never restarts', async ({
  page,
}) => {
  await observe(page);
  await page.goto('/tests/fixtures/host.html');
  const frame = page.frameLocator('iframe');
  const body = frame.locator('body');
  const active = () =>
    body.evaluate(() =>
      window.musicProbe.some(
        (p) => !p.player.paused && p.player.readyState >= 3,
      ),
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
  await frame
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect.poll(active).toBe(true);
  await send('paused');
  await expect.poll(active).toBe(false);
  await send('resumed');
  await expect.poll(active).toBe(true);
  await body.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(active).toBe(false);
  await send('paused');
  await body.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await active()).toBe(false);
  await send('resumed');
  await expect.poll(active).toBe(true);
  await send('closed');
  await expect.poll(active).toBe(false);
  await frame
    .getByRole('button', { name: 'В главное меню', exact: true })
    .click();
  expect(await active()).toBe(false);
});

test('an outgoing track playing late cannot cancel the workshop transition', async ({
  page,
}) => {
  await observe(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    '**/audio/game-music/the-road-is-sleeping-v1.mp3',
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  try {
    await page.goto('/');
    await page.evaluate(() => {
      document.addEventListener(
        'click',
        () => {
          // Inject only the late media event, after React applies the destination.
          // Real decoding/playback of the requested workshop track remains intact.
          setTimeout(() => {
            const player = window.musicProbe[0]?.player;
            if (player?.src.includes('the-road-is-sleeping'))
              player.dispatchEvent(new Event('playing'));
          }, 0);
        },
        { once: true },
      );
    });
    await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
    await playing(page, 'martas-workshop');
  } finally {
    release();
  }
});

test('late or missing music never blocks play or starts after muting', async ({
  page,
}) => {
  await observe(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    '**/audio/game-music/the-road-is-sleeping-v1.mp3',
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.route('**/audio/game-music/martas-workshop-v1.mp3', (route) =>
    route.abort(),
  );
  try {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
      .click();
    await page
      .getByRole('button', { name: 'В главное меню', exact: true })
      .click();
    await page.getByRole('button', { name: 'Музыка меню и главы' }).click();
    release();
    await expect.poll(async () => (await read(page)).playing).toBe(false);
    await page.getByRole('button', { name: 'Музыка меню и главы' }).click();
    await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
    await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
      timeout: 15000,
    });
    await expect(talk(page)).toContainText('Проснулся, Люми?');
    await expect
      .poll(async () => (await read(page)).src)
      .toContain('martas-workshop');
    await expect
      .poll(() => page.evaluate(() => !!window.musicProbe[0]!.player.error))
      .toBe(true);
  } finally {
    release();
  }
});
