import { expect, test, type Page } from '@playwright/test';
import { activeCat, observeAudio } from './helpers/cat-audio';
import cues from '../src/game/cat-mouth-cues.json' with { type: 'json' };
import { field } from './helpers/workshop';

const portrait = (page: Page) =>
  page.locator('.cat-dialogue .cat-portrait-motion');
const repeat = (page: Page) =>
  page.getByRole('button', { name: 'Повторить реплику' });
async function open(page: Page) {
  await observeAudio(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await expect.poll(() => activeCat(page), { timeout: 15000 }).toBe(1);
}
async function seekPose(page: Page, open: boolean) {
  const cue = cues.clips[0]!;
  const index = cue.frames.indexOf(open ? '111' : '000');
  expect(index).toBeGreaterThanOrEqual(0);
  await page.evaluate(
    (seconds) => {
      const player = window.voiceTestPlayers.find(
        (p) => p.src.includes('/audio/cat/') && !p.paused && !p.ended,
      )!;
      player.playbackRate = 0.1;
      player.currentTime = seconds;
    },
    (index + 0.5) * cues.step,
  );
  await expect(portrait(page)).toHaveAttribute(
    'data-mouth',
    open ? 'open' : 'closed',
  );
  await expect(field(page)).toHaveAttribute(
    'data-cat-mouth',
    open ? 'open' : 'closed',
  );
  await expect(field(page)).toHaveAttribute('data-cat-frame', open ? '5' : '4');
}
async function resting(page: Page) {
  await expect(portrait(page)).toHaveAttribute('data-mouth', 'rest');
  await expect(field(page)).toHaveAttribute('data-cat-mouth', 'rest');
  await expect(field(page)).toHaveAttribute('data-cat-frame', '0');
}

test('portrait and scene cat follow the same recording, stop for pause, mute and reduced motion', async ({
  page,
}, info) => {
  await open(page);
  await seekPose(page, true);
  await page.screenshot({ path: info.outputPath('cat-speaking.png') });
  await seekPose(page, false);
  await page.screenshot({ path: info.outputPath('cat-silent.png') });
  await page.getByRole('button', { name: 'Голос кота', exact: true }).click();
  await resting(page);
  await expect.poll(() => activeCat(page)).toBe(0);
  await page.getByRole('button', { name: 'Голос кота', exact: true }).click();
  await repeat(page).click();
  await seekPose(page, true);
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await resting(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => activeCat(page)).toBe(0);
  await resting(page);
  await repeat(page).click();
  await seekPose(page, true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resting(page);
  await expect.poll(() => activeCat(page)).toBe(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seekPose(page, true);
  await page.evaluate(() => {
    const player = window.voiceTestPlayers.find(
      (p) => p.src.includes('/audio/cat/') && !p.paused,
    )!;
    player.currentTime = player.duration - 0.1;
    player.playbackRate = 1;
  });
  await expect.poll(() => activeCat(page)).toBe(0);
  await resting(page);
});

test('portrait and scene cat do not speak while the recording is waiting for the network', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/audio/cat/**', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await open(page);
    await resting(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.voiceTestPlayers.find((p) => p.src.includes('/audio/cat/'))
              ?.readyState,
        ),
      )
      .toBe(0);
    release();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.voiceTestPlayers.find((p) => p.src.includes('/audio/cat/'))
              ?.readyState,
        ),
      )
      .toBeGreaterThanOrEqual(3);
    await seekPose(page, true);
  } finally {
    release();
  }
});
