import { expect, test, type Page } from '@playwright/test';
import { finishTalk, field } from './helpers/workshop';

type SfxProbe = {
  decoded: number;
  nodes: { source: AudioBufferSourceNode; gain?: GainNode; active: boolean }[];
};
declare global {
  interface Window {
    sfxProbe: SfxProbe;
  }
}
async function observe(page: Page) {
  await page.addInitScript(() => {
    window.sfxProbe = { decoded: 0, nodes: [] };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (data, success, error) {
      return decode.call(this, data, success, error).then((buffer) => {
        window.sfxProbe.decoded++;
        return buffer;
      });
    };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const entry: SfxProbe['nodes'][number] = { source, active: false };
      window.sfxProbe.nodes.push(entry);
      const start = source.start.bind(source),
        stop = source.stop.bind(source);
      source.start = (...args) => {
        entry.active = true;
        start(...args);
      };
      source.stop = (when) => {
        entry.active = false;
        stop(when);
      };
      source.addEventListener('ended', () => {
        entry.active = false;
      });
      return source;
    };
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = createGain.call(this);
      const last = window.sfxProbe.nodes.at(-1);
      if (last) last.gain = gain;
      return gain;
    };
  });
}
const count = (page: Page) => page.evaluate(() => window.sfxProbe.nodes.length);
const active = (page: Page) =>
  page.evaluate(() => window.sfxProbe.nodes.filter((n) => n.active).length);
async function ready(page: Page) {
  await expect
    .poll(() => page.evaluate(() => window.sfxProbe.decoded))
    .toBeGreaterThanOrEqual(9);
}

test('title and pause share an effects switch, and menu clicks play real buffers', async ({
  page,
}, info) => {
  await observe(page);
  await page.goto('/');
  await ready(page);
  await page.screenshot({ path: info.outputPath('title-sound.png') });
  const toggle = page.getByRole('button', {
    name: 'Звуки игры и меню',
    exact: true,
  });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  expect(await count(page)).toBe(0);
  await page.keyboard.press('Escape');
  await toggle.click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect.poll(() => count(page)).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: /^Настройки/ }).click();
  const check = page.getByRole('checkbox', { name: 'Звуки игры и меню' });
  await expect(check).toBeChecked();
  await check.uncheck();
  await expect.poll(() => active(page)).toBe(0);
  await page.screenshot({ path: info.outputPath('pause-sound.png') });
});

test('world actions sound once, success stops for pause and hidden tabs never resume effects', async ({
  page,
}) => {
  await observe(page);
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.keyboard.press('KeyD');
  await finishTalk(page, 'Попробовать');
  await page.keyboard.press('KeyA');
  const before = await count(page);
  await page.keyboard.press('KeyW');
  await expect.poll(() => count(page)).toBeGreaterThan(before);
  await expect(field(page)).toHaveAttribute('data-frame-feedback', 'assembled');
  // A short human-scale gap separates assembly feedback from the apply action.
  await expect.poll(() => active(page)).toBe(0);
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sfxProbe.nodes.some(
          (n) => n.active && (n.source.buffer?.duration ?? 0) > 1,
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.sfxProbe.nodes
            .filter((n) => (n.source.buffer?.duration ?? 0) > 1)
            .at(-1)?.gain?.gain.value ?? 1,
      ),
    )
    .toBeLessThan(0.3);
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sfxProbe.nodes.some(
          (n) => n.active && (n.source.buffer?.duration ?? 0) > 1,
        ),
      ),
    )
    .toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => active(page)).toBe(0);
  const stopped = await count(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await count(page)).toBe(stopped);
});

test('SDK pause and closed silence menus; resume never replays a click', async ({
  page,
}) => {
  await observe(page);
  await page.goto('/tests/fixtures/host.html');
  const frame = page.frameLocator('iframe');
  const body = frame.locator('body');
  await expect
    .poll(() => body.evaluate(() => window.sfxProbe.decoded))
    .toBeGreaterThanOrEqual(9);
  const map = frame.getByRole('button', {
    name: 'Карта фонарей · главы и эпизоды',
  });
  const count = () => body.evaluate(() => window.sfxProbe.nodes.length);
  const active = () =>
    body.evaluate(() => window.sfxProbe.nodes.filter((n) => n.active).length);
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
  await map.click();
  await expect.poll(count).toBe(1);
  await send('paused');
  await expect.poll(active).toBe(0);
  await page.keyboard.press('Escape');
  await map.click();
  expect(await count()).toBe(1);
  await send('resumed');
  await page.keyboard.press('Escape');
  await map.click();
  await expect.poll(count).toBe(2);
  await send('closed');
  await expect.poll(active).toBe(0);
  await page.keyboard.press('Escape');
  await map.click();
  expect(await count()).toBe(2);
});

test('slow downloads discard an obsolete menu sound; unavailable effects do not block entry', async ({
  page,
}) => {
  await observe(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/audio/game-sfx/ui-v1.wav', async (route) => {
    await gate;
    await route.continue();
  });
  await page.route('**/audio/game-sfx/push-v1.wav', (route) => route.abort());
  try {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
      .click();
    await page.waitForTimeout(450); // Intentionally exceed the stale-cue deadline.
    release();
    await expect
      .poll(() => page.evaluate(() => window.sfxProbe.decoded))
      .toBeGreaterThanOrEqual(8);
    expect(await count(page)).toBe(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
    await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
      timeout: 15000,
    });
    await expect(
      page.getByRole('region', { name: 'Разговор с котом' }),
    ).toBeVisible();
  } finally {
    release();
  }
});
